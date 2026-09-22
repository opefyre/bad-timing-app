import { EventInput } from '@/types';
import { getJson } from './http';
import { run,skip } from './connectors/base';
import { arr,obj,str,iso,windowFor,finding,during } from './connectors/util';
import { addLocalDays,instantToLocal,zonedLocalToUtc } from './time';
import { defaultPreference } from './preferences';
export async function checkDaylight(input:EventInput){
 if(!input.isOutdoor)return skip('daylight','Indoor event');
 return run('daylight',input,async()=>{const date=input.dateTime.slice(0,10);const next=addLocalDays(`${date}T00:00`,1).slice(0,10);const w=windowFor(input);
  const u=new URL('https://api.sunrise-sunset.org/v2');u.search=new URLSearchParams({lat:String(input.venue.lat),lng:String(input.venue.lng),date_start:date,date_end:next,tz:input.venue.timezone!}).toString();
  const response=await getJson(u.toString(),86400000),root=obj(response.data);if(!Array.isArray(root.days))throw new Error('Unexpected daylight response');let partial=false;
  const days=arr(root.days).map(obj);const wanted=new Set([date,instantToLocal(new Date(w.end.getTime()-1),input.venue.timezone!).slice(0,10)]);for(const d of wanted)if(!days.some(r=>r.date===d))partial=true;
  const data=days.flatMap(d=>{const day=str(d.date);if(!wanted.has(day))return [];const ds=zonedLocalToUtc(day+'T00:00',input.venue.timezone!).toISOString(),de=zonedLocalToUtc(addLocalDays(day+'T00:00',1),input.venue.timezone!).toISOString();
   if(d.sun_status==='midnight_sun')return [];const rise=iso(d.sunrise),set=iso(d.sunset);
   const periods:Array<[string,string,string]>=d.sun_status==='polar_night'?[[ds,de,'Sun does not rise']]:rise&&set?[[ds,rise,'Before sunrise'],[set,de,'After sunset']]:[];
   if(!periods.length){partial=true;return [];}
   return periods.filter(([s,e])=>during(input,s,e)).map(([s,e,label])=>finding(`dark:${day}:${label}`,'daylight',label,'https://sunrise-sunset.org/',{type:'daylight',policyKey:'daylight:darkness',source:'Sunrise-Sunset.org',description:'Part of the event falls outside sunrise-to-sunset daylight.',startsAt:s,endsAt:e,preference:defaultPreference('daylight',input),evidence:'structured',timing:'scheduled',relevance:'overlap',resolutionEligible:true,impact:'medium',caveat:'Twilight, terrain and cloud cover affect usable light.'}));
  });return {data,partial,fetchedAt:response.fetchedAt,message:partial?'Some solar times are unavailable for this place and date.':undefined};
 });
}
