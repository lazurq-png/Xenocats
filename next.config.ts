import type { NextConfig } from 'next';

// Security headers on every response. The Content-Security-Policy is not here: it
// carries a nonce of its own on every request, so proxy.ts builds it (app/lib/csp.ts),
// and so a response the proxy's matcher skips has none: a static file, or the
// not-found page for a missing one, which shows nothing a visitor wrote.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Browsers honour it only over HTTPS, so it does nothing on http://localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  // A page of another site that opens this one (a link with a target, a popup) gets
  // no handle on its window, nor this one on its opener: nothing to steer or watch
  // across them. The site opens no popups of its own, and signs in with no provider's.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  // No X-Powered-By: Next.js: it tells nobody anything they need.
  poweredByHeader: false,
  // The images in /public are already small WebPs, served as they are. Next's
  // optimizer (/_next/image, as of 16.3.6) hangs for good on an image whose first
  // request is aborted mid-encode — a navigation away at the wrong moment — and
  // every later request for it then waits until the server restarts.
  images: { unoptimized: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
