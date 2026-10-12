import type { Metadata, Viewport } from 'next';
import { pageMetadata, siteUrl } from '@/lib/seo';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  ...pageMetadata('Bad Timing: check clashes before your event', 'Check an event date and place against public sources for weather, holidays, sports and transport disruptions. Review clashes before inviting people.', '/'),
  icons: { icon: '/bad-timing-logo.svg' },
};

export const viewport: Viewport = { themeColor: '#0b0d0c', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
