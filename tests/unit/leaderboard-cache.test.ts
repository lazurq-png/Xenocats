import { beforeEach, describe, expect, it, vi } from 'vitest';

// The leaderboard's board is kept in Next's data cache under one tag, which a saved
// run updates; the viewer's own best is read on every request (fetchLeaderboard,
// app/lib/data.ts). Next's cache stands in as a map: one result per key until the
// tag is updated. What the queries return is data.test.ts's, against a database.

const { sql, cache } = vi.hoisted(() => {
  const queries: string[] = [];
  const sql = Object.assign(
    vi.fn((strings: TemplateStringsArray) => {
      const text = strings.join('?');
      queries.push(text);
      const rows = text.includes('WHERE user_id')
        ? [{ run_minutes: 5, place: 12, name: 'Me', time_ms: 1000, sent_home: 3 }]
        : [{ run_minutes: 5, place: 1, name: 'Top', time_ms: 300_000, sent_home: 900 }];
      return Promise.resolve(rows);
    }),
    { queries }
  );
  const stored = new Map<string, unknown>();
  const tagsOf = new Map<string, string[]>();
  const cache = {
    stored,
    options: [] as { keys: string[]; tags: string[]; revalidate?: number }[],
    unstable_cache: (
      fn: () => Promise<unknown>,
      keys: string[],
      options: { tags: string[]; revalidate?: number }
    ) => {
      cache.options.push({ keys, ...options });
      return async () => {
        const key = keys.join('/');
        tagsOf.set(key, options.tags);
        if (!stored.has(key)) stored.set(key, await fn());
        return stored.get(key);
      };
    },
    updateTag: (tag: string) => {
      for (const [key, tags] of tagsOf) if (tags.includes(tag)) stored.delete(key);
    },
  };
  return { sql, cache };
});
vi.mock('@/app/lib/db', () => ({ sql }));
vi.stubEnv('POSTGRES_URL', 'postgres://user:secret@localhost:5432/db?search_path=xenocats_x');
vi.mock('next/cache', () => ({
  unstable_cache: cache.unstable_cache,
  updateTag: cache.updateTag,
  revalidatePath: vi.fn(),
}));

const { fetchLeaderboard, LEADERBOARD_TAG } = await import('@/app/lib/data');

/** The board's queries and the viewer's, among those sent so far. */
const sent = () => ({
  board: sql.queries.filter((q) => q.includes('WHERE place <=')).length,
  own: sql.queries.filter((q) => q.includes('WHERE user_id')).length,
});

beforeEach(() => {
  sql.queries.length = 0;
  cache.stored.clear();
});

describe('the leaderboard cache', () => {
  it('is keyed by the schema read, never the URL, and expires within a minute besides the tag', () => {
    const [{ keys, tags, revalidate }] = cache.options;
    expect(keys).toContain('xenocats_x');
    expect(keys.join()).not.toContain('secret');
    expect(tags).toEqual([LEADERBOARD_TAG]);
    expect(revalidate).toBe(60);
  });

  it('reads the board once for every request, until a run is saved', async () => {
    await fetchLeaderboard(null);
    await fetchLeaderboard(null);
    await fetchLeaderboard('00000000-0000-4000-8000-000000000001');
    expect(sent().board).toBe(1);

    cache.updateTag(LEADERBOARD_TAG);
    await fetchLeaderboard(null);
    expect(sent().board).toBe(2);
  });

  it("reads the viewer's own best on every request, and none for nobody", async () => {
    const viewer = '00000000-0000-4000-8000-000000000001';
    const { board, mine } = await fetchLeaderboard(viewer);
    await fetchLeaderboard(viewer);
    await fetchLeaderboard(null);
    expect(sent().own).toBe(2);
    // Below the board: theirs, with its place; the board's rows are not theirs.
    expect(mine[5]).toMatchObject({ place: 12, name: 'Me', mine: true });
    expect(board[5]).toEqual([expect.objectContaining({ name: 'Top', mine: false })]);
  });
});
