import { NextRequest, NextResponse } from 'next/server';
import { analyzeEvent } from '@/lib/analyzer';
import { EventInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const input = await request.json() as EventInput;
    if (!input.venue?.address) return NextResponse.json({ error: 'Venue is required' }, { status: 400 });
    if (!input.dateTime) return NextResponse.json({ error: 'Date and time are required' }, { status: 400 });
    if (!input.durationMinutes || input.durationMinutes < 15 || input.durationMinutes > 24 * 60) return NextResponse.json({ error: 'Duration must be between 15 minutes and 24 hours' }, { status: 400 });
    const report = await analyzeEvent(input, { siteOrigin: request.nextUrl.origin });
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed' }, { status: 500 });
  }
}
