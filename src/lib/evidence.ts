import { CheckResult, Conflict, EventInput } from '@/types';
import { defaultPreference } from './preferences';
import { safeUrl,text,iso } from './connectors/util';
export function normalizeFindings(result:CheckResult,input:EventInput):Conflict[]{
 return result.data.filter(c=>c&&c.id&&c.title).map(c=>{
 const startsAt=iso(c.startsAt),endsAt=iso(c.endsAt);const bounded=!!startsAt&&!!endsAt&&Date.parse(startsAt)<Date.parse(endsAt);
 const inferredTiming=c.type==='weather'?'forecast':bounded?'scheduled':'unknown';
 const timing=c.timing??inferredTiming;
 const relevance=c.relevance??(bounded?'overlap':'context');
 const resolutionEligible=result.state==='checked'&&(c.resolutionEligible??(bounded&&timing!=='unknown'&&timing!=='live'));
 return {...c,title:text(c.title,240),description:text(c.description,1000),providerId:c.providerId??result.sourceId,startsAt,endsAt,sourceUrl:safeUrl(c.sourceUrl)||safeUrl(result.url),timing,relevance,resolutionEligible,evidence:c.evidence??(['bank-holidays','tfl'].includes(result.sourceId)?'official':'structured'),retrievedAt:c.retrievedAt??result.fetchedAt??result.lastChecked,preference:c.preference??defaultPreference(c.type,input)};
 });
}
export function deduplicate(findings:Conflict[]):Conflict[]{
 const map=new Map<string,Conflict>();
 for(const c of findings){const previous=map.get(c.id);if(!previous){map.set(c.id,c);continue;}
  // Same source record may affect several stops. Never merge different providers based on approximate coordinates or a headline.
  const differingWindow=previous.startsAt!==c.startsAt||previous.endsAt!==c.endsAt;
  if(differingWindow){const k=`${c.id}:${c.startsAt??''}:${c.endsAt??''}`;map.set(k,{...c,id:k,policyKey:c.policyKey??c.id});continue;}
  map.set(c.id,{...previous,distanceKm:Math.min(previous.distanceKm??Infinity,c.distanceKm??Infinity)===Infinity?undefined:Math.min(previous.distanceKm??Infinity,c.distanceKm??Infinity),resolutionEligible:previous.resolutionEligible&&c.resolutionEligible});
 }
 return [...map.values()].sort((a,b)=>{
 const rank=(c:Conflict)=>(c.type==='warning'?0:1)*100+({high:0,medium:1,low:2}[c.impact])*10+(c.relevance==='overlap'?0:2);
 return rank(a)-rank(b)||(a.startsAt??'z').localeCompare(b.startsAt??'z')||a.title.localeCompare(b.title);
 });
}
