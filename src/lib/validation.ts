import { EventInput, EventKind, EventPreference, FootballTeam, PreferenceOverrides } from '@/types';
import { localParts, zonedLocalToUtc } from './time';
export class InputError extends Error {}
const kinds:EventKind[]=['birthday','dinner','meetup','workshop','outdoor_activity','screening','other'];
function record(v:unknown):Record<string,unknown> { if(!v||typeof v!=='object'||Array.isArray(v))throw new InputError('Check the event details.');return v as Record<string,unknown>; }
function string(v:unknown,max:number,required=false):string|undefined {
  if(v===undefined||v===null||v===''){if(required)throw new InputError('Complete the event details.');return undefined;}
  if(typeof v!=='string'||v.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v))throw new InputError('Check the event details.');if(required&&!v.trim())throw new InputError('Complete the event details.');return v.trim()||undefined;
}
export function validateEvent(raw:unknown):EventInput {
 const r=record(raw),v=record(r.venue);const address=string(v.address,500,true)!;
 const dateTime=string(r.dateTime,25,true)!;
 try{localParts(dateTime);}catch(e){throw new InputError((e as Error).message);}
 const durationMinutes=r.durationMinutes;
 if(typeof durationMinutes!=='number'||!Number.isInteger(durationMinutes)||durationMinutes<15||durationMinutes>1440)throw new InputError('Duration must be 15 minutes to 24 hours.');
 const eventKind=r.eventKind as EventKind;if(!kinds.includes(eventKind)||typeof r.isOutdoor!=='boolean')throw new InputError('Choose the event type and setting.');
 const timezone=string(v.timezone,80);if(timezone)try{zonedLocalToUtc(dateTime,timezone);}catch(e){throw new InputError((e as Error).message);}
 const lat=v.lat,lng=v.lng;
 if((lat!==undefined||lng!==undefined)&&(typeof lat!=='number'||!Number.isFinite(lat)||Math.abs(lat)>90||typeof lng!=='number'||!Number.isFinite(lng)||Math.abs(lng)>180))throw new InputError('Choose a valid map location.');
 const countryCode=string(v.countryCode,2);if(countryCode&&!/^[a-z]{2}$/i.test(countryCode))throw new InputError('Check the country.');
 const radiusKm=r.radiusKm??3;if(typeof radiusKm!=='number'||!Number.isFinite(radiusKm)||radiusKm<.5||radiusKm>20)throw new InputError('Choose a search radius between 0.5 and 20 km.');
 const programmeId=r.programmeId;if(programmeId!==undefined&&(typeof programmeId!=='number'||!Number.isSafeInteger(programmeId)||programmeId<1))throw new InputError('Choose a programme from the search results.');
 for(const k of ['includeNews','needsInternet'])if(r[k]!==undefined&&typeof r[k]!=='boolean')throw new InputError('Check the event options.');
 const rawTeams=r.footballTeams;let footballTeams:FootballTeam[]|undefined;
 if(rawTeams!==undefined&&rawTeams!==null){
   if(!Array.isArray(rawTeams)||rawTeams.length>10)throw new InputError('Choose up to 10 football teams.');
   footballTeams=[];const seen=new Set<number>();
   for(const item of rawTeams){const t=record(item);const id=t.id,name=string(t.name,60);
     if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1||!name||seen.has(id))throw new InputError('Choose a team from the search results.');
     seen.add(id);footballTeams.push({id,name});}
   if(!footballTeams.length)footballTeams=undefined;
 }
 return {venue:{address,lat:lat as number|undefined,lng:lng as number|undefined,timezone,countryCode,name:string(v.name,150),state:string(v.state,150),city:string(v.city,150),countryName:string(v.countryName,150),subdivisionCode:string(v.subdivisionCode,25)},dateTime,durationMinutes,eventKind,isOutdoor:r.isOutdoor,radiusKm,programmeId:programmeId as number|undefined,programmeName:string(r.programmeName,150),footballTeams,footballTeam:string(r.footballTeam,150),includeNews:r.includeNews===true,needsInternet:r.needsInternet===true};
}
export function validatePreferences(raw:unknown):PreferenceOverrides {
 if(raw===undefined)return {};const v=record(raw),out:PreferenceOverrides=Object.create(null);
 if(Object.keys(v).length>600)throw new InputError('Too many preference changes.');
 for(const [k,val] of Object.entries(v)){if(k.length>250||['__proto__','constructor','prototype'].includes(k)||!['avoid','neutral','plan_around'].includes(String(val)))throw new InputError('Check the preferences.');out[k]=val as EventPreference;}
 return out;
}
