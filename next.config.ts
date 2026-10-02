import type { NextConfig } from 'next';

// Security headers on every response. The Content-Security-Policy is fixed here
// rather than built per request, so it cannot carry a nonce: Next's own inline
// scripts (the page's flight data) need 'unsafe-inline' for scripts, and the
// cats' and charts' inline styles need it for styles. Everything else the app
// loads is its own: fonts self-hosted by next/font, images from /public and
// /_next/image (and data: URIs, e.g. the form plugin's SVG icons), sounds
// synthesised with Web Audio (which CSP does not govern).
// `next dev` also needs eval (React's dev tooling) and a WebSocket (hot reload).
const isDev = process.env.NODE_ENV === 'development';

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? ' ws: wss:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Browsers honour it only over HTTPS, so it does nothing on http://localhost.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
