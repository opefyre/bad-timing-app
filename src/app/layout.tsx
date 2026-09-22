import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BAD TIMING — Check before you invite',
  description: 'Check public outside-world conflicts around an event and find the smallest timing change that helps.',
};

export const viewport: Viewport = { themeColor: '#0b0d0c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
