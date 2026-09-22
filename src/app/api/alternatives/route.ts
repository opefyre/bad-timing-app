import { NextRequest, NextResponse } from 'next/server';
import { findAlternatives } from '@/lib/alternatives';
import { PreferenceOverrides, Report } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { report?: Report; preferences?: PreferenceOverrides };
    if (!body.report?.event) return NextResponse.json({ error: 'Report is required' }, { status: 400 });
    const suggestions = await findAlternatives(body.report, body.preferences ?? {});
    return NextResponse.json({ suggestions });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not find alternatives' }, { status: 500 });
  }
}
