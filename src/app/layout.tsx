import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bad Timing',
  description: 'Check what might interfere with an event before you invite people.',
  icons: { icon: '/bad-timing-logo.svg' },
};

export const viewport: Viewport = { themeColor: '#0b0d0c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
