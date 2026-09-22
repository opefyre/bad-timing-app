import { NextRequest } from 'next/server';
import { analyzeEvent } from '@/lib/analyzer';
import { findAlternatives } from '@/lib/alternatives';
import { InputError,validateEvent,validatePreferences } from '@/lib/validation';
import { guard,readBody,apiError,json } from '@/lib/api-guard';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(request:NextRequest){
 const denied=guard(request,20);if(denied)return denied;
 try{const body=await readBody(request) as Record<string,unknown>;if(!body||!['earlier','another_day'].includes(String(body.mode)))throw new InputError('Choose earlier or another day.');
  const event=validateEvent(body.event),preferences=validatePreferences(body.preferences);
  // The browser cannot supply or modify the evidence used by the optimizer.
  const report=await analyzeEvent(event);const suggestions=await findAlternatives(report,preferences,{},body.mode as 'earlier'|'another_day');
  return json({...report,suggestions,alternativeNote:suggestions.length?undefined:'No verified improvement among the times checked. Live reports, missing coverage or unknown times may prevent a comparison.'});
 }catch(e){return apiError(e);}
}
