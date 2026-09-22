import { NextRequest } from 'next/server';
import { analyzeEvent } from '@/lib/analyzer';
import { validateEvent } from '@/lib/validation';
import { guard,readBody,apiError,json } from '@/lib/api-guard';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:NextRequest){const denied=guard(request,8);if(denied)return denied;try{return json(await analyzeEvent(validateEvent(await readBody(request))));}catch(e){return apiError(e);}}
