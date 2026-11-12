// The Content-Security-Policy, built for each request by proxy.ts with a nonce of
// its own: only scripts that carry it run (Next.js puts it on its own scripts, the
// framework's and the page's, when it renders; app/layout.tsx makes every page
// render per request, so every page gets one). 'strict-dynamic' lets the scripts
// they load run too. So an injected <script>, inline or not, does not run, where
// 'unsafe-inline' let it: React's escaping is no longer the only defence.
//
// Styles keep 'unsafe-inline': the cats' and charts' inline styles need it, and a
// nonce in style-src would switch it off. Everything else the app loads is its own:
// fonts self-hosted by next/font, images from /public (and data: URIs, e.g. the form
// plugin's SVG icons), sounds synthesised with Web Audio (which CSP does not govern).
// `next dev` also needs eval (React's dev tooling) and a WebSocket (hot reload).

/** A nonce: 128 random bits, base64, new for every request. */
export function newNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** The policy for one response, its scripts allowed by `nonce`. */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
