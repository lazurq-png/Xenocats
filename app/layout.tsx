import '@/app/ui/global.css';
import { display, sans, ui } from '@/app/ui/fonts';
import { Metadata } from 'next';
import { connection } from 'next/server';

export const metadata: Metadata = {
  title: {
    template: '%s | Xenocat Analytics',
    default: 'Xenocat Analytics',
  },
  description: 'Invoices and customers at a glance, haunted by alien cats.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Every page is rendered per request, never at build time: only then does it get
  // the nonce of the request's Content-Security-Policy (proxy.ts, app/lib/csp.ts),
  // without which its scripts would not run.
  await connection();
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${ui.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
