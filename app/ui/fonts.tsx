import { Montserrat, Orbitron, Roboto } from 'next/font/google';

// The mockup's three typefaces: Orbitron for display type, Montserrat for the
// public pages' copy, Roboto for the dashboard. Exposed as CSS variables that the
// theme in global.css maps to font-display, font-sans and font-ui.
export const display = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });
export const sans = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });
export const ui = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
});
