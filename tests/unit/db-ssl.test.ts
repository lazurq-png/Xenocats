import { describe, expect, it } from 'vitest';
import { databaseSsl } from '@/app/lib/db-ssl';

// The TLS mode of the app's database connection (app/lib/db.ts). That
// 'verify-full' really refuses a certificate nobody signed is shown against a
// real server in tests/unit/data.test.ts ("TLS to the database").

describe('databaseSsl', () => {
  it('checks the certificate on Vercel', () => {
    expect(databaseSsl({ VERCEL: '1' })).toBe('verify-full');
  });

  it('elsewhere encrypts without checking: the development and CI servers sign their own', () => {
    expect(databaseSsl({})).toBe('require');
    expect(databaseSsl({ VERCEL: '' })).toBe('require');
    expect(databaseSsl({ VERCEL: '0' })).toBe('require');
  });
});
