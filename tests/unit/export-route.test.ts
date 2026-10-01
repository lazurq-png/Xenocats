import { beforeEach, describe, expect, it, vi } from 'vitest';

// The CSV export route, with the session and the database replaced by fakes.
const { auth, fetchInvoicesForExport } = vi.hoisted(() => ({
  auth: vi.fn(),
  fetchInvoicesForExport: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth }));
// A cap of 2 rows, so the over-the-cap case needs only three.
vi.mock('@/app/lib/data', () => ({ EXPORT_LIMIT: 2, fetchInvoicesForExport }));

const { GET } = await import('@/app/dashboard/invoices/export/route');

const request = (search = '') => new Request(`http://localhost/dashboard/invoices/export${search}`);

beforeEach(() => {
  vi.clearAllMocks();
  fetchInvoicesForExport.mockResolvedValue([
    {
      date: '2023-06-27',
      name: 'Evil Rabbit',
      email: 'evil@rabbit.com',
      amount: 66600,
      status: 'pending',
    },
    { date: '2023-06-09', name: '=HYPERLINK("x")', email: 'a@b.c', amount: 5, status: 'paid' },
  ]);
});

describe('without a session', () => {
  it('refuses with 401 and reads nothing', async () => {
    auth.mockResolvedValue(null);
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(fetchInvoicesForExport).not.toHaveBeenCalled();
  });

  it('treats a session without a user as none', async () => {
    auth.mockResolvedValue({ expires: '2099-01-01' });
    expect((await GET(request())).status).toBe(401);
    expect(fetchInvoicesForExport).not.toHaveBeenCalled();
  });
});

describe('with a session', () => {
  beforeEach(() => auth.mockResolvedValue({ user: { email: 'user@nextmail.com' } }));

  it('sends a CSV download of the filtered list, safe for spreadsheets', async () => {
    const response = await GET(request('?query=rabbit&status=pending'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="invoices.csv"');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(fetchInvoicesForExport).toHaveBeenCalledWith('rabbit', 'pending');

    // A UTF-8 byte-order mark first (text() would drop it, so read the bytes).
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const body = await response.text();
    expect(body.split('\r\n')).toEqual([
      'Date,Customer,Email,Amount,Status',
      '2023-06-27,Evil Rabbit,evil@rabbit.com,666.00,pending',
      `2023-06-09,"'=HYPERLINK(""x"")",a@b.c,0.05,paid`,
      '',
    ]);
  });

  it('refuses rather than send a file that is cut short', async () => {
    fetchInvoicesForExport.mockResolvedValue(
      [1, 2, 3].map((n) => ({
        date: '2023-01-0' + n,
        name: 'n',
        email: 'e',
        amount: n,
        status: 'paid',
      }))
    );
    const response = await GET(request());
    expect(response.status).toBe(422);
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(await response.text()).toContain('Narrow the search');
  });

  it('ignores an unknown status, as the list does', async () => {
    await GET(request('?status=bogus'));
    expect(fetchInvoicesForExport).toHaveBeenCalledWith('', null);
  });
});
