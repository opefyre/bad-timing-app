import { Conflict,EventInput } from '@/types';
import { getJson } from '../http';
import { geometryDistance } from '../parsers/geometry';
import { TransitAlert } from '../parsers/gtfs';
import { arr,obj,str,num,text,safeUrl,iso,hash,bounds,radius,windowFor,during,currentEvent,finding,mapLimit } from './util';
import { run,commercial } from './base';
import { provider } from './catalog';

export function parseTomTom(raw:unknown,input:EventInput):{data:Conflict[];partial:boolean}{
  const root=obj(raw);if(!Array.isArray(root.incidents))throw new Error('Unexpected traffic response');const data:Conflict[]=[];let partial=false;
  const titles:Record<string,string>={roadClosed:'Road closure',roadWorks:'Roadworks',accident:'Road accident',jam:'Traffic congestion',laneClosed:'Lane closure',flooding:'Road flooding',brokenDownVehicle:'Broken-down vehicle',dangerousConditions:'Dangerous road conditions'};
  for(const value of arr(root.incidents)){const r=obj(value),p=obj(r.properties);const km=geometryDistance(input,r.geometry);if(!Number.isFinite(km)){partial=true;continue;}if(km>radius(input))continue;
    const startsAt=iso(p.startTime),endsAt=iso(p.endTime);const planned=p.timeValidity==='future';
    const exact=!!startsAt&&!!endsAt;
    if(exact&&!during(input,startsAt,endsAt))continue;
    if(!exact&&!currentEvent(input,Date.now(),24)&&!planned)continue;
    const eventDescriptions=arr(p.events).map(obj).map(e=>text(e.description)).filter(Boolean);
    const category=str(p.iconCategory);const probability=text(p.probabilityOfOccurrence);
    data.push(finding(str(p.id)||hash(JSON.stringify(p)),'tomtom','TomTom Traffic',provider('tomtom').website,{type:'road',title:titles[category]||'Road disruption',description:eventDescriptions.join(' · ')||`Published disruption${p.from?` near ${text(p.from)}`:''}.`,startsAt,endsAt,distanceKm:km,placeName:text(p.from),impact:category==='roadClosed'?'medium':'low',preference:'avoid',evidence:'structured',timing:planned?'scheduled':'live',relevance:exact?'overlap':'context',resolutionEligible:exact&&planned&&(!probability||probability==='certain'),certainty:probability||undefined,caveat:exact?'The published incident window may change. This is not a route-specific delay prediction.':'The end time is unknown; a change of event time cannot confirm that this has cleared.'}));
  }return {data,partial};
}
export async function checkTomTom(input:EventInput){
  return run('tomtom',input,async()=>{
    const params=new URLSearchParams({apiVersion:'2',bbox:bounds(input).join(','),timeValidity:'present,future'});
    const {data:raw,fetchedAt}=await getJson(`https://api.tomtom.com/maps/orbis/traffic/incidents/details?${params}`,120000,{'TomTom-Api-Key':process.env.TOMTOM_API_KEY!,'TomTom-Api-Version':'2','Accept-Language':'en-GB',Attributes:'incidents'});
    return {...parseTomTom(raw,input),fetchedAt,limitations:['Only published current/future incidents in the selected radius are searched.']};
  },{key:'TOMTOM_API_KEY'});
}

export function translation(raw:unknown):string {
  const values=arr(raw).map(obj);return text(values.find(r=>str(r.language).toLowerCase().startsWith('en'))?.text??values[0]?.text);
}
function seconds(value:unknown):string|undefined {
  const n=num(value);return n!==undefined?iso(n*1000):iso(value);
}
export function transitFindings(alerts:TransitAlert[],input:EventInput,source:{id:string;name:string;url:string;place?:string}):Conflict[]{
  const data:Conflict[]=[];
  for(const alert of alerts){
    const title=translation(alert.header_text)||'Public transport notice';const description=translation(alert.description_text);const periods=(alert.active_period??[]).length?alert.active_period:[{}];
    for(let i=0;i<periods.length;i++){const p=periods[i];const startsAt=seconds(p.start),endsAt=seconds(p.end);const w=windowFor(input);
      // In GTFS, a missing bound is infinite; preserve that semantic, not an invented end.
      if(startsAt&&new Date(startsAt)>=w.end)continue;if(endsAt&&new Date(endsAt)<=w.start)continue;
      const bounded=!!startsAt&&!!endsAt;const severe=['NO_SERVICE','STOP_MOVED','DETOUR','1','4','9'].includes(str(alert.effect));
      const stable=alert.id||hash(title+description);
      data.push(finding(`${stable}:${i}`,source.id,source.name,safeUrl(translation(alert.url))||source.url,{type:'transport',title,description:description||'An operator has published a service notice.',startsAt,endsAt,placeName:source.place,impact:severe?'medium':'low',preference:severe?'avoid':'neutral',evidence:'official',timing:bounded?'scheduled':'live',resolutionEligible:bounded,relevance:bounded?'overlap':'context',publisherSeverity:str(alert.severity_level),caveat:bounded?'Published service windows can change.':'The agency has not supplied a complete time window.'}));
    }
  }return data;
}
export async function checkTransitland(input:EventInput){
  return run('transitland',input,async()=>{
    const base='https://transit.land/api/v2/rest';const headers={apikey:process.env.TRANSITLAND_API_KEY!};
    const params=new URLSearchParams({lat:String(input.venue.lat),lon:String(input.venue.lng),radius:String(Math.min(2000,radius(input)*1000)),limit:'100',include_alerts:'true',include_routes:'true'});
    if(commercial()){params.set('license_commercial_use_allowed','yes');params.set('license_redistribution_allowed','yes');}
    const {data:raw,fetchedAt}=await getJson(`${base}/stops?${params}`,120000,headers);const root=obj(raw);
    if(!Array.isArray(root.stops))throw new Error('Unexpected transit response');const data:Conflict[]=[];const routeIds=new Set<string>();const agencyIds=new Set<string>();let partial=!!obj(root.meta).next;
    for(const stop of arr(root.stops).map(obj)){
      const src={id:'transitland',name:'Transitland / transport operator',url:safeUrl(stop.stop_url)||provider('transitland').website,place:text(stop.stop_name)};
      data.push(...transitFindings(arr(stop.alerts) as TransitAlert[],input,src));
      const routes=arr(stop.routes).concat(arr(stop.route_stops).map(v=>obj(v).route));
      for(const route of routes.map(obj)){if(route.id!==undefined)routeIds.add(str(route.id));const agency=obj(route.agency);if(agency.id!==undefined)agencyIds.add(str(agency.id));}
    }
    // Stop endpoint excludes route-only and agency-only selectors. Query a bounded set.
    if(routeIds.size>6||agencyIds.size>4)partial=true;
    const lookups=[...Array.from(routeIds).slice(0,6).map(id=>({kind:'routes',id})),...Array.from(agencyIds).slice(0,4).map(id=>({kind:'agencies',id}))];
    const extra=await mapLimit(lookups,2,async({kind,id})=>{
      try{const {data:raw}=await getJson(`${base}/${kind}/${encodeURIComponent(id)}?include_alerts=true`,120000,headers);const root=obj(raw);const rows=arr(root[kind]);if(!Array.isArray(root[kind])){partial=true;return [];}
        return rows.flatMap(v=>{const r=obj(v);return transitFindings([...arr(r.alerts),...arr(obj(r.agency).alerts)] as TransitAlert[],input,{id:'transitland',name:'Transitland / transport operator',url:provider('transitland').website,place:text(r.route_long_name||r.agency_name)});});}
      catch{partial=true;return [];}
    });
    data.push(...extra.flat());const unique=Array.from(new Map(data.map(c=>[c.id,c])).values());
    // Aggregated stop results alone cannot establish that GTFS-RT was available and fresh.
    return {data:unique,partial:true,message:partial?'A bounded subset of nearby transit alerts was checked':'Nearby stop/route alerts checked; trip-only alerts and feed freshness are not fully exposed',fetchedAt,limitations:['Nearby-stop lookup does not guarantee agency-wide or trip-specific coverage. Missing alerts may mean no realtime feed, not no disruption.']};
  },{key:'TRANSITLAND_API_KEY'});
}
