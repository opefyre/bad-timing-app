import { NextResponse } from 'next/server';

type Context = {
  params: Promise<{ z: string; x: string; y: string }>;
};

export async function GET(_request: Request, { params }: Context) {
  const { z, x, y } = await params;
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) return new NextResponse(null, { status: 500 });
  if (!/^\d+$/.test(z) || !/^\d+$/.test(x) || !/^\d+$/.test(y)) return new NextResponse(null, { status: 400 });

  const url = `https://maps.geoapify.com/v1/tile/osm-bright/${z}/${x}/${y}.png?apiKey=${apiKey}`;
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return new NextResponse(null, { status: res.status });
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}