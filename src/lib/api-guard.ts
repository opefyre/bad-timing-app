import { createHash,randomBytes } from 'node:crypto';
import { NextRequest,NextResponse } from 'next/server';
import { InputError } from './validation';
const salt=randomBytes(16).toString('hex');
const buckets=new Map<string,{until:number;used:number}>();
export function guard(request:NextRequest,cost=1):NextResponse|null{
 const origin=request.headers.get('origin'),site=process.env.SITE_URL;
 const allowed=new Set([request.nextUrl.origin]);if(site)try{allowed.add(new URL(site).origin);}catch{}
 if(request.headers.get('sec-fetch-site')==='cross-site'||origin&&!allowed.has(origin))return NextResponse.json({error:'Open the app directly to run a check.'},{status:403});
 const now=Date.now();for(const [key,b]of buckets)if(b.until<now)buckets.delete(key);
 // Hosting must supply a trusted client IP header. This is a per-instance safeguard, not a global quota service.
 const ip=request.headers.get('x-real-ip')||request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'shared';
 const key=createHash('sha256').update(salt+ip).digest('hex');
 if(buckets.size>3000)return NextResponse.json({error:'Busy right now. Try again shortly.'},{status:429,headers:{'Retry-After':'60'}});
 const b=buckets.get(key)??{until:now+60000,used:0};b.used+=cost;buckets.set(key,b);
 if(b.used>60)return NextResponse.json({error:'Too many requests. Try again shortly.'},{status:429,headers:{'Retry-After':'60'}});
 return null;
}
export async function readBody(request:NextRequest):Promise<unknown>{
 if(!request.headers.get('content-type')?.includes('application/json'))throw new InputError('Send event details as JSON.');
 if(Number(request.headers.get('content-length'))>131072)throw new InputError('Request is too large.');
 const reader=request.body?.getReader();if(!reader)throw new InputError('Event details are missing.');
 let size=0;const parts:Uint8Array[]=[];const timer=setTimeout(()=>void reader.cancel(),10000);
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072){await reader.cancel();throw new InputError('Request is too large.');}parts.push(value);}
  const all=new Uint8Array(size);let off=0;for(const part of parts){all.set(part,off);off+=part.length;}return JSON.parse(new TextDecoder().decode(all));
 }catch(e){if(e instanceof InputError)throw e;throw new InputError('Check the event details.');}finally{clearTimeout(timer);}
}
export function apiError(error:unknown){return NextResponse.json({error:error instanceof InputError?error.message:'Could not complete this check. Try again.'},{status:error instanceof InputError?400:502,headers:{'Cache-Control':'no-store'}});}
export function json(data:unknown){return NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});}
