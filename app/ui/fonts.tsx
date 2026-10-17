import localFont from 'next/font/local';

// The mockup's three typefaces: Orbitron for display type, Montserrat for the
// public pages' copy, Roboto for the dashboard. Exposed as CSS variables that the
// theme in global.css maps to font-display, font-sans and font-ui.
//
// Self-hosted, not next/font/google: `next dev --turbopack` downloads Google's
// stylesheet on every cold start, and now and then fails to resolve the font
// files it names, so no page compiles. The files in ./fonts are Google Fonts'
// latin-subset variable fonts, under the SIL Open Font License beside them.
export const display = localFont({
  src: './fonts/orbitron-latin.woff2',
  weight: '400 900',
  variable: '--font-orbitron',
});
export const sans = localFont({
  src: './fonts/montserrat-latin.woff2',
  weight: '100 900',
  variable: '--font-montserrat',
});
export const ui = localFont({
  src: './fonts/roboto-latin.woff2',
  weight: '100 900',
  variable: '--font-roboto',
});
