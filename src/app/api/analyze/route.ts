import { NextRequest, NextResponse } from 'next/server';
import { analyzeEvent } from '@/lib/analyzer';
import { EventInput } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const input: EventInput = await request.json();
    if (!input.venue?.address) return NextResponse.json({ error: 'Venue address is required' }, { status: 400 });
    if (!input.dateTime) return NextResponse.json({ error: 'Date and time are required' }, { status: 400 });
    const report = await analyzeEvent(input);
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed' }, { status: 500 });
  }
}
