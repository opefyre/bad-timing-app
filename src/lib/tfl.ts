import { CheckResult, Conflict, EventInput } from '@/types';
import { getJson, safeMessage } from './http';
import { isGreaterLondon } from './geo';
import { defaultPreference } from './preferences';
import { eventWindow, instantToLocal, localDate } from './time';
import { iso, hash } from './connectors/util';

type Validity = { from?: string; to?: string; isNow?: boolean };
type Disruption = { id?: string; category?: string; categoryDescription?: string; description?: string; additionalInfo?: string; closureText?: string; validityPeriods?: Validity[] };
type Stop = { id: string; commonName?: string; lines?: Array<{ id: string; name?: string }> };
type LineStatus = { statusSeverity?: number; statusSeverityDescription?: string; reason?: string; validityPeriods?: Validity[] };
type Line = { id: string; name: string; lineStatuses?: LineStatus[] };
function keyed(url:URL){if(process.env.TFL_APP_KEY)url.searchParams.set('app_key',process.env.TFL_APP_KEY);return url.toString();}
/** Keep each actual validity window; never use the first unrelated window in a response. */
export function tflPeriods(periods:Validity[]|undefined,input:EventInput):Array<{startsAt?:string;endsAt?:string}> {
 const {start,end}=eventWindow(input.dateTime,input.durationMinutes,input.venue.timezone!);
 if(!periods?.length)return Math.abs(start.getTime()-Date.now())<24*3600000?[{}]:[];
 return periods.flatMap(p=>{const startsAt=iso(p.from),endsAt=iso(p.to);
  if(startsAt&&new Date(startsAt)>=end||endsAt&&new Date(endsAt)<=start)return [];
  if(!startsAt&&!endsAt&&Math.abs(start.getTime()-Date.now())>=24*3600000)return [];
  return [{startsAt,endsAt}];});
}
export async function checkTfLDisruptions(input:EventInput):Promise<CheckResult>{
 const base={source:'Transport for London',sourceId:'tfl',url:'https://tfl.gov.uk/info-for/open-data-users/',lastChecked:new Date().toISOString()};
 const {lat,lng,timezone}=input.venue;
 if(typeof lat!=='number'||typeof lng!=='number'||!timezone||!isGreaterLondon(lat,lng))return {...base,state:'not_applicable',data:[],message:'London only'};
 try{
  const u=new URL('https://api.tfl.gov.uk/StopPoint');u.search=new URLSearchParams({lat:String(lat),lon:String(lng),radius:'1200',stopTypes:'NaptanMetroStation,NaptanRailStation,NaptanBusCoachStation',useStopPointHierarchy:'true'}).toString();
  const {data:rawStops}=await getJson(keyed(u),6*3600000);
  const root=rawStops as {stopPoints?:Stop[]};
  if(!root||!Array.isArray(root.stopPoints))throw new Error('Unexpected stops response');
  const nearby=root.stopPoints.slice(0,6);let partial=root.stopPoints.length>6;const findings:Conflict[]=[];
  const add=(id:string,title:string,description:string,periods:Validity[]|undefined,impact:'high'|'medium')=>{
   if(!periods?.length)partial=true;
   for(const p of tflPeriods(periods,input)){const bounded=!!p.startsAt&&!!p.endsAt;if(!bounded)partial=true;
    findings.push({id:`tfl-${id}-${hash(JSON.stringify(p))}`,type:'transport',title,description,impact,source:base.source,sourceUrl:'https://tfl.gov.uk/status-updates',preference:defaultPreference('transport',input),...p,providerId:'tfl',evidence:'official',timing:bounded?'scheduled':'live',relevance:bounded?'overlap':'context',resolutionEligible:bounded,caveat:bounded?'Published service windows can change.':'A complete validity period was not supplied.'});}
  };
  const stopIds=nearby.map(s=>s.id).filter(Boolean);
  if(stopIds.length){const {data:rows}=await getJson(keyed(new URL(`https://api.tfl.gov.uk/StopPoint/${stopIds.map(encodeURIComponent).join(',')}/Disruption`)),300000);if(!Array.isArray(rows))throw new Error('Unexpected stop disruptions');
   for(const d of rows as Disruption[])add(d.id||hash(JSON.stringify(d)),d.categoryDescription||d.category||'Nearby service change',d.description||d.additionalInfo||d.closureText||'TfL reports a service change.',d.validityPeriods,'medium');}
  const allLines=Array.from(new Set(nearby.flatMap(s=>(s.lines??[]).map(l=>l.id))));if(allLines.length>10)partial=true;
  const lineIds=allLines.slice(0,10),date=localDate(input.dateTime),last=instantToLocal(eventWindow(input.dateTime,input.durationMinutes,timezone).end,timezone).slice(0,10);
  if(lineIds.length){const {data:rows}=await getJson(keyed(new URL(`https://api.tfl.gov.uk/Line/${lineIds.map(encodeURIComponent).join(',')}/Status/${date}/to/${last}`)),300000);if(!Array.isArray(rows))throw new Error('Unexpected line statuses');
   for(const line of rows as Line[]){if(!Array.isArray(line.lineStatuses)){partial=true;continue;}for(const s of line.lineStatuses){if(!s.reason||s.statusSeverityDescription?.toLowerCase()==='good service')continue;add(`line-${line.id}-${s.statusSeverity??0}`,`${line.name}: ${s.statusSeverityDescription||'service change'}`,s.reason,s.validityPeriods,s.statusSeverity!==undefined&&s.statusSeverity<=5?'high':'medium');}}
  }
  return {...base,state:partial?'partial':'checked',data:Array.from(new Map(findings.map(f=>[f.id,f])).values()),message:partial?'A bounded set of nearby stops and lines was checked; some validity or local coverage is incomplete':undefined,limitations:['Nearby stations and serving lines only; not an attendee’s full journey.']};
 }catch(e){return {...base,state:'unavailable',data:[],message:safeMessage(e)};}
}
