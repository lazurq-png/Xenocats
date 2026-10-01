import '@/app/ui/global.css';
import { display, sans, ui } from '@/app/ui/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Xenocat Analytics',
    default: 'Xenocat Analytics',
  },
  description: 'Invoices and customers at a glance, haunted by alien cats.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${ui.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
