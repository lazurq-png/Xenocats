import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, newNonce } from '@/app/lib/csp';

// The Content-Security-Policy proxy.ts sends with every page (app/lib/csp.ts). That
// the pages carry its nonce and still work under it is security-headers.spec.ts's.

const directive = (policy: string, name: string) =>
  policy.split('; ').find((d) => d.startsWith(`${name} `)) ?? '';

describe('contentSecurityPolicy', () => {
  it('lets scripts run by their nonce only: no unsafe-inline for them', () => {
    const scripts = directive(contentSecurityPolicy('abc123', false), 'script-src');
    expect(scripts).toBe("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(scripts).not.toContain('unsafe-inline');
    expect(scripts).not.toContain('unsafe-eval');
  });

  it('keeps the rest of the policy', () => {
    const policy = contentSecurityPolicy('n', false);
    for (const part of [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ]) {
      expect(policy).toContain(part);
    }
  });

  it('allows next dev what it needs, and only there', () => {
    const dev = contentSecurityPolicy('n', true);
    expect(directive(dev, 'script-src')).toContain("'unsafe-eval'");
    expect(directive(dev, 'connect-src')).toBe("connect-src 'self' ws: wss:");
  });
});

describe('newNonce', () => {
  it('is 128 random bits in base64, new every time', () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
