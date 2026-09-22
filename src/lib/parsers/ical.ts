import { Conflict,EventInput } from '@/types';
import { FeedConfig } from '../connectors/feed-config';
import { addLocalDays,zonedLocalToUtc } from '../time';
import { geometryDistance } from './geometry';
import { finding,hash,iso,safeUrl,text,radius,during } from '../connectors/util';
interface Property{value:string;params:Record<string,string>}
type Entry=Map<string,Property[]>;
const first=(e:Entry,k:string)=>e.get(k)?.[0];
const decoded=(s:string)=>s.replace(/\\[nN]/g,'\n').replace(/\\([,;\\])/g,'$1');
function local(p:Property):string{
  const m=/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?(Z)?$/.exec(p.value);if(!m)throw new Error('Unsupported calendar datetime');
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]??'00'}:${m[5]??'00'}:${m[6]??'00'}`;
}
export function calendarTime(p:Property|undefined,c:FeedConfig):string|undefined{
  if(!p)return;const wall=local(p);if(p.value.endsWith('Z'))return iso(wall+'Z');
  const zone=p.params.TZID||c.timezone;if(!zone)throw new Error('Floating calendar time needs a configured timezone');return zonedLocalToUtc(wall,zone).toISOString();
}
function read(raw:string):Entry[]{
  if(raw.length>5_000_000||!raw.includes('BEGIN:VCALENDAR'))throw new Error('Invalid calendar');
  const lines=raw.replace(/\r?\n[ \t]/g,'').split(/\r?\n/);const result:Entry[]=[];let entry:Entry|undefined;let nested=0;
  for(const line of lines){if(line==='BEGIN:VEVENT'){entry=new Map();nested=0;continue;}if(line==='END:VEVENT'){if(entry)result.push(entry);entry=undefined;continue;}if(!entry)continue;
    if(line.startsWith('BEGIN:')){nested++;continue;}if(line.startsWith('END:')){nested--;continue;}if(nested)continue;
    const match=/^([^:]+):(.*)$/.exec(line);if(!match)continue;const [key,...ps]=match[1].split(';');const params:Record<string,string>={};for(const p of ps){const n=p.indexOf('=');if(n>0)params[p.slice(0,n)]=p.slice(n+1).replace(/^"|"$/g,'');}
    const values=entry.get(key.toUpperCase())??[];values.push({value:match[2],params});entry.set(key.toUpperCase(),values);
    if(result.length>5000)throw new Error('Too many calendar events');
  }if(entry)throw new Error('Unclosed calendar event');return result;
}
/** Daily/weekly RRULE + EXDATE, RDATE and single-instance overrides. Unsupported recurrence
 * is surfaced as partial coverage rather than fabricated or silently treated as one-off. */
export function parseIcal(raw:string,input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const entries=read(raw);const data:Conflict[]=[];let partial=false;
  const overrides=new Map<string,Entry>();
  for(const e of entries){const rid=first(e,'RECURRENCE-ID');if(rid){if(rid.params.RANGE){partial=true;continue;}try{overrides.set(`${first(e,'UID')?.value}|${calendarTime(rid,c)}`,e);}catch{partial=true;}}}
  for(const original of entries){if(first(original,'RECURRENCE-ID'))continue;if(first(original,'STATUS')?.value==='CANCELLED')continue;
    try{
      const start=first(original,'DTSTART');if(!start){partial=true;continue;}const startUtc=calendarTime(start,c)!;const end=first(original,'DTEND');
      let endUtc=calendarTime(end,c);let duration=endUtc?new Date(endUtc).getTime()-new Date(startUtc).getTime():undefined;
      const dur=first(original,'DURATION')?.value;
      if(!endUtc&&dur){const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(dur);if(!m){partial=true;continue;}duration=(+(m[1]??0)*86400+ +(m[2]??0)*3600+ +(m[3]??0)*60+ +(m[4]??0))*1000;}
      if(duration===undefined&&start.params.VALUE==='DATE'){endUtc=calendarTime({value:addLocalDays(local(start).slice(0,16),1).slice(0,10).replace(/-/g,''),params:start.params},c);duration=new Date(endUtc!).getTime()-new Date(startUtc).getTime();}
      if(duration===undefined||duration<=0){partial=true;continue;}
      const uid=first(original,'UID')?.value||hash(first(original,'SUMMARY')?.value??startUtc);
      if(overrides.size)partial=true; // Overrides are displayed where matched; distant moved instances may require a fuller calendar adapter.
      const dates:Property[]=[];const rule=first(original,'RRULE')?.value;
      if(rule){const parts:Record<string,string>=Object.fromEntries(rule.split(';').map(s=>s.split('=')));if(!['DAILY','WEEKLY'].includes(parts.FREQ)||Object.keys(parts).some(k=>!['FREQ','INTERVAL','COUNT','UNTIL','BYDAY','WKST'].includes(k))){partial=true;continue;}
        const interval=Number(parts.INTERVAL??1),count=parts.COUNT?Number(parts.COUNT):Infinity;if(!Number.isInteger(interval)||interval<1||count<1||Number.isNaN(count)||parts.COUNT&&!Number.isInteger(count)){partial=true;continue;}
        const byday=parts.BYDAY?.split(',');if(byday?.some(d=>!['MO','TU','WE','TH','FR','SA','SU'].includes(d))){partial=true;continue;}
        const days=['SU','MO','TU','WE','TH','FR','SA'];const baseWall=local(start);const baseDay=new Date(baseWall.slice(0,10)+'T00:00:00Z').getUTCDay();
        const until=parts.UNTIL?calendarTime({value:parts.UNTIL,params:start.params},c):undefined;
        const targetEnd=new Date(input.dateTime.slice(0,10)+'T00:00:00Z').getTime()+2*86400000;let emitted=0;let scanned=0;
        const wkst=days.indexOf(parts.WKST??'MO');
        for(let day=0;day<10000;day++){scanned=day;const wall=addLocalDays(baseWall.slice(0,16),day);const dayMs=new Date(wall.slice(0,10)+'T00:00:00Z').getTime();if(dayMs>targetEnd)break;
          const dow=(baseDay+day)%7;const week=Math.floor((day+(baseDay-wkst+7)%7)/7);
          const scheduled=day===0||parts.FREQ==='DAILY'?(day===0||day%interval===0&&(!byday||byday.includes(days[dow]))):week%interval===0&&(byday??[days[baseDay]]).includes(days[dow]);
          if(!scheduled)continue;
          const date:Property={params:start.params,value:wall.slice(0,10).replace(/-/g,'')+(start.params.VALUE==='DATE'?'':'T'+wall.slice(11).replace(':','')+'00'+(start.value.endsWith('Z')?'Z':''))};
          const utc=calendarTime(date,c)!;if(until&&new Date(utc)>new Date(until))break;if(++emitted>count)break;dates.push(date);
        }if(scanned===9999)partial=true;
      }else dates.push(start);
      for(const rdate of original.get('RDATE')??[]){if(rdate.params.VALUE==='PERIOD'){partial=true;continue;}for(const v of rdate.value.split(','))dates.push({...rdate,value:v});}
      const exclude=new Set((original.get('EXDATE')??[]).flatMap(p=>p.value.split(',').map(value=>calendarTime({...p,value},c))));const seen=new Set<string>();
      for(const date of dates){let startsAt=calendarTime(date,c)!;if(exclude.has(startsAt)||seen.has(startsAt))continue;seen.add(startsAt);
        const override=overrides.get(`${uid}|${startsAt}`);const e=override??original;if(first(e,'STATUS')?.value==='CANCELLED')continue;
        if(override)startsAt=calendarTime(first(e,'DTSTART'),c)??startsAt;
        let endsAt=override?calendarTime(first(e,'DTEND'),c):undefined;
        // Preserve local-wall end on recurring events when DTEND exists, including DST transitions.
        if(!endsAt&&end&&!override){const wallDelta=new Date(local(end)+'Z').getTime()-new Date(local(start)+'Z').getTime();const wall=new Date(new Date(local(date)+'Z').getTime()+wallDelta).toISOString().slice(0,19);endsAt=calendarTime({params:end.params,value:wall.replace(/[-:]/g,'')+(end.value.endsWith('Z')?'Z':'')},c);}
        endsAt??=new Date(new Date(startsAt).getTime()+duration).toISOString();if(!during(input,startsAt,endsAt))continue;
        const geo=first(e,'GEO')?.value.split(';').map(Number);const coords=geo?.length===2&&geo.every(Number.isFinite)?[geo[1],geo[0]]:c.staticLocation?[c.staticLocation.lng,c.staticLocation.lat]:undefined;
        let km=Infinity;if(coords)km=geometryDistance(input,{type:'Point',coordinates:coords});else if(c.areaGeometry)km=geometryDistance(input,c.areaGeometry);
        if(!Number.isFinite(km)){partial=true;continue;}if(km>radius(input))continue;
        data.push(finding(`${uid}:${calendarTime(date,c)}`,c.id,c.name,safeUrl(first(e,'URL')?.value)||c.publicUrl,{type:c.type??'nearby_event',title:text(decoded(first(e,'SUMMARY')?.value??'Calendar event')),description:text(decoded(first(e,'DESCRIPTION')?.value??'')),startsAt,endsAt,distanceKm:km,placeName:decoded(first(e,'LOCATION')?.value??c.staticLocation?.name??''),timing:'scheduled',evidence:'official',relevance:'overlap',resolutionEligible:true}));
      }
    }catch{partial=true;}
  }return {data,partial};
}
