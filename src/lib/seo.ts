import type { Metadata } from 'next';

export const siteUrl = 'https://badtiming.abosh.io';
const image = { url: 'https://abosh.io/work/bad-timing/home.webp', width: 2400, height: 1500, alt: 'Bad Timing: check a place and time for event clashes' };

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title, description,
    alternates: { canonical: path },
    openGraph: { type: 'website', siteName: 'Bad Timing', title, description, url: path, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
