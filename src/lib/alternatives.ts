import { Conflict, EventInput, PreferenceOverrides, Report, Suggestion } from '@/types';
import { AnalysisContext,analyzeEvent } from './analyzer';
import { addLocalDays,addLocalMinutes,formatLocalDateTime,instantToLocal,minuteDistance,zonedLocalToUtc } from './time';
import { preferenceFor,preferenceKey } from './preferences';
export type AlternativeMode=Suggestion['mode'];
function eligible(c:Conflict,report:Report){return c.resolutionEligible===true&&c.relevance==='overlap'&&report.sources.some(s=>s.id===c.providerId&&s.state==='checked'&&s.scope!=='current');}
function weight(c:Conflict){return {high:3,medium:2,low:1}[c.impact];}
function titleSet(items:Conflict[]){return [...new Set(items.map(c=>c.title))];}
export function compareReports(base:Report,candidate:Report,overrides:PreferenceOverrides,mode:AlternativeMode):Suggestion|null{
 const baseAvoid=base.conflicts.filter(c=>preferenceFor(c,overrides)==='avoid');
 const canResolve=baseAvoid.filter(c=>eligible(c,base));
 const context=baseAvoid.filter(c=>!eligible(c,base));
 const nextAvoid=candidate.conflicts.filter(c=>preferenceFor(c,overrides)==='avoid');
 const baseChecked=base.sources.filter(s=>s.state==='checked'&&s.scope!=='current'&&s.scope!=='discovery'&&s.id!=='geoapify');
 // A failed, partial, missing or out-of-range source is never evidence of an improvement.
 if(baseChecked.some(s=>!candidate.sources.some(n=>n.id===s.id&&n.state==='checked'&&n.scope!=='current')))return null;
 const nextKeys=new Set(nextAvoid.map(preferenceKey)),baseKeys=new Set(baseAvoid.map(preferenceKey));
 const resolved=canResolve.filter(c=>!nextKeys.has(preferenceKey(c)));
 const remaining=canResolve.filter(c=>nextKeys.has(preferenceKey(c)));
 const added=nextAvoid.filter(c=>!baseKeys.has(preferenceKey(c)));
 if(added.some(c=>c.type==='warning'||c.impact==='high'))return null;
 if(added.reduce((n,c)=>n+weight(c),0)>=resolved.reduce((n,c)=>n+weight(c),0)&&resolved.length)return null;
 const plans=base.conflicts.filter(c=>preferenceFor(c,overrides)==='plan_around');
 const nextMap=new Map(candidate.conflicts.map(c=>[preferenceKey(c),c]));
 const kept=plans.filter(c=>nextMap.has(preferenceKey(c)));const lost=plans.filter(c=>!nextMap.has(preferenceKey(c)));
 const baseTime=zonedLocalToUtc(base.event.dateTime,base.event.venue.timezone!).getTime(),nextTime=zonedLocalToUtc(candidate.event.dateTime,candidate.event.venue.timezone!).getTime();
 const improved=kept.filter(c=>c.startsAt&&c.timing==='scheduled'&&Math.abs(Date.parse(c.startsAt)-nextTime)<Math.abs(Date.parse(c.startsAt)-baseTime));
 if(!resolved.length&&(!improved.length||added.length))return null;
 return {mode,change:mode==='earlier'?`Start earlier · ${formatLocalDateTime(candidate.event.dateTime)}`:`Keep ${base.event.dateTime.slice(11,16)} · ${formatLocalDateTime(candidate.event.dateTime)}`,newDateTime:candidate.event.dateTime,conflictsResolved:titleSet(resolved),conflictsRemaining:titleSet(remaining),conflictsAdded:titleSet(added),unresolvedContext:titleSet(context),planAroundKept:titleSet(kept),planAroundLost:titleSet(lost),planAroundImproved:titleSet(improved),avoidCount:remaining.length+added.length+context.length,changeMinutes:minuteDistance(base.event.dateTime,candidate.event.dateTime),checkedAt:candidate.checkedAt,coverageNote:'Compared only against the connected sources and times checked. Live reports and unknown end times remain unresolved.'};
}
export function candidateTimes(base:Report,overrides:PreferenceOverrides,mode:AlternativeMode):string[]{
 if(mode==='another_day')return [1,2,3,7].map(d=>addLocalDays(base.event.dateTime,d));
 const options=[-15,-30,-45,-60,-90,-120,-180,-240].map(m=>addLocalMinutes(base.event.dateTime,m));
 const initial=zonedLocalToUtc(base.event.dateTime,base.event.venue.timezone!).getTime();
 for(const c of base.conflicts){if(!c.startsAt||c.timing!=='scheduled')continue;const pref=preferenceFor(c,overrides);
  const target=Date.parse(c.startsAt)-(pref==='avoid'?base.event.durationMinutes*60000:0);
  if((pref==='avoid'&&eligible(c,base)||pref==='plan_around')&&target<initial&&target>=initial-4*3600000)options.push(instantToLocal(new Date(target),base.event.venue.timezone!).slice(0,16));
 }
 return [...new Set(options)].filter(t=>t.slice(0,10)===base.event.dateTime.slice(0,10)).sort((a,b)=>b.localeCompare(a)).slice(0,12);
}
export async function findAlternatives(base:Report,overrides:PreferenceOverrides={},context:AnalysisContext={},mode:AlternativeMode='earlier',analyzer:typeof analyzeEvent=analyzeEvent):Promise<Suggestion[]>{
 if(!base.conflicts.some(c=>preferenceFor(c,overrides)==='plan_around'||preferenceFor(c,overrides)==='avoid'&&eligible(c,base)))return [];
 const candidates:Suggestion[]=[];let count=0;const deadline=Date.now()+90000;
 for(const dateTime of candidateTimes(base,overrides,mode)){
  if(Date.now()>deadline)break;
  let start:Date;try{start=zonedLocalToUtc(dateTime,base.event.venue.timezone!);}catch{continue;}
  if(start.getTime()<Date.now())continue;
  const event:EventInput={...base.event,venue:{...base.event.venue},dateTime};const checked=await analyzer(event,context);count++;
  const compared=compareReports(base,checked,overrides,mode);if(compared)candidates.push(compared);
  if(compared&&!compared.conflictsRemaining.length&&!compared.conflictsAdded.length&&!compared.planAroundLost?.length)break;
 }
 candidates.sort((a,b)=>a.avoidCount-b.avoidCount||(a.planAroundLost?.length??0)-(b.planAroundLost?.length??0)||a.changeMinutes-b.changeMinutes);
 return candidates.slice(0,1).map(s=>({...s,candidateCount:count}));
}
