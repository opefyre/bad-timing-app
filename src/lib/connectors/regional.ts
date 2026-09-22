import { CheckResult,Conflict,EventInput } from '@/types';
import { configuredFeeds,feedApplies,feedFamily,FeedConfig } from './feed-config';
import { feedRequest } from './feed-http';
import { parseCapDocuments } from '../parsers/cap';
import { parseDatex } from '../parsers/datex';
import { parseIcal } from '../parsers/ical';
import { decodeGtfs,TransitAlert } from '../parsers/gtfs';
import { parseXml,children,descendants,value,content,deepValue } from '../parsers/xml';
import { geometryDistance } from '../parsers/geometry';
import { addLocalDays,zonedLocalToUtc } from '../time';
import { transitFindings } from './transport';
import { provider } from './catalog';
import { skip } from './base';
import { arr,obj,str,num,text,safeUrl,iso,hash,distance,radius,windowFor,during,currentEvent,finding,outcome,failure,mapLimit } from './util';

function field(row:unknown,path?:string):unknown {
  if(!path)return undefined;return path.split('.').reduce<unknown>((r,k)=>obj(r)[k],row);
}
export function recordTime(raw:unknown,c:FeedConfig,end=false):string|undefined{
  const absolute=iso(raw);if(absolute)return absolute;
  let v=str(raw);if(!v)return;
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)){v+='T00:00';if(end&&c.dateOnlyEndInclusive)v=addLocalDays(v,1);}
  if(!c.timezone||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(v))return;
  try{return zonedLocalToUtc(v.slice(0,19),c.timezone).toISOString();}catch{return;}
}
export function normalizeCivic(rows:unknown[],input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const f=c.fields;if(!f)throw new Error('Field mapping required');const data:Conflict[]=[];let partial=false;
  for(const raw of rows){const wrapper=obj(raw),row=wrapper.type==='Feature'?obj(wrapper.properties):wrapper;
    if(f.status&&(c.cancelledValues??[]).includes(str(field(row,f.status))))continue;
    const id=str(field(row,f.id)),title=text(field(row,f.title));if(!id||!title){partial=true;continue;}
    const customGeometry=field(row,f.geometry);let geometry=wrapper.geometry||customGeometry;
    if(obj(customGeometry).latitude!==undefined)geometry={type:'Point',coordinates:[obj(customGeometry).longitude,obj(customGeometry).latitude]};
    if(!geometry&&f.lat&&f.lon)geometry={type:'Point',coordinates:[num(field(row,f.lon)),num(field(row,f.lat))]};
    if(!geometry&&c.staticLocation)geometry={type:'Point',coordinates:[c.staticLocation.lng,c.staticLocation.lat]};
    if(!geometry&&c.areaGeometry)geometry=c.areaGeometry;
    const km=geometryDistance(input,geometry);if(!Number.isFinite(km)){partial=true;continue;}if(km>radius(input))continue;
    const startsAt=recordTime(field(row,f.start),c),endsAt=recordTime(field(row,f.end),c,true);const mode=c.timeMode??'scheduled';
    if(mode==='scheduled'&&startsAt&&endsAt&&!during(input,startsAt,endsAt))continue;
    if(mode!=='scheduled'&&!currentEvent(input,Date.now(),48))continue;
    const updated=recordTime(field(row,f.updated),c);
    if(mode!=='scheduled'&&updated&&Date.now()-new Date(updated).getTime()>(c.maxAgeHours??72)*3600000)continue;
    const scheduled=mode==='scheduled'&&!!startsAt&&!!endsAt;
    if(mode==='scheduled'&&!scheduled)partial=true;
    data.push(finding(id,c.id,c.name,safeUrl(field(row,f.url))||c.publicUrl,{type:c.type??'civic',title,description:text(field(row,f.description))||'Published local notice.',evidence:'official',startsAt:mode==='published'?undefined:startsAt,endsAt:mode==='published'?undefined:endsAt,timing:scheduled?'scheduled':mode==='current'?'live':'unknown',relevance:scheduled?'overlap':'context',resolutionEligible:scheduled,distanceKm:km,observedAt:updated,preference:c.type==='road'?'avoid':'neutral',caveat:scheduled?'Published times can change.':mode==='published'?'Publication date is not an event date.':'No complete event window was provided.'}));
  }return {data,partial};
}
function renderQuery(template:string,input:EventInput):string{
  const w=windowFor(input);const vars:Record<string,string>={start:w.start.toISOString(),end:w.end.toISOString(),date:input.dateTime.slice(0,10),lat:String(input.venue.lat),lon:String(input.venue.lng),radiusMeters:String(radius(input)*1000)};
  return template.replace(/\{\{(\w+)\}\}/g,(_,key:string)=>{if(!(key in vars))throw new Error('Unknown query substitution');return vars[key];});
}
export async function queryCivic(input:EventInput,c:FeedConfig):Promise<{data:Conflict[];partial:boolean;fetchedAt?:string}>{
  const perPage=Math.max(10,Math.min(500,c.limit??200)),maxPages=c.pageLimit??2;let partial=false;let fetchedAt:string|undefined;const rows:unknown[]=[];
  for(let page=0;page<maxPages;page++){
    let requestUrl=c.endpoint;let init:RequestInit={};
    if(c.kind==='arcgis'){
      const u=new URL(c.endpoint.replace(/\/$/,'')+'/query');const [w,s,e,n]=boundsFor(input);
      for(const [k,v] of Object.entries({f:'geojson',where:renderQuery(c.where??'1=1',input),geometry:`${w},${s},${e},${n}`,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:'*',returnGeometry:'true',resultRecordCount:String(perPage),resultOffset:String(page*perPage)}))u.searchParams.set(k,v);
      if(c.orderBy)u.searchParams.set('orderByFields',c.orderBy);requestUrl=u.toString();
    }else if(c.kind==='socrata'){
      const u=new URL(c.endpoint);u.pathname=`/api/v3/views/${encodeURIComponent(c.datasetId!)}/query.json`;requestUrl=u.toString();
      const query=`SELECT *${c.where?` WHERE ${renderQuery(c.where,input)}`:''}${c.orderBy?` ORDER BY ${c.orderBy}`:''}`;
      init={method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,page:{pageNumber:page+1,pageSize:perPage},includeSynthetic:false,timeout:7})};
    }else if(c.kind==='ckan'){
      const u=new URL(c.endpoint.replace(/\/$/,'')+'/api/3/action/datastore_search');u.searchParams.set('resource_id',c.resourceId!);u.searchParams.set('limit',String(perPage));u.searchParams.set('offset',String(page*perPage));if(c.orderBy)u.searchParams.set('sort',c.orderBy);requestUrl=u.toString();
    }
    const r=await feedRequest(c,'json',requestUrl,init);fetchedAt=r.fetchedAt;const root=obj(r.data);let current:unknown[];let more=false;
    if(c.kind==='arcgis'){if(root.error||!Array.isArray(root.features))throw new Error('Layer query failed');current=arr(root.features);more=root.exceededTransferLimit===true||current.length===perPage;}
    else if(c.kind==='ckan'){if(root.success!==true||!Array.isArray(obj(root.result).records))throw new Error('DataStore query failed');current=arr(obj(root.result).records);const total=num(obj(root.result).total);more=total!==undefined?total>(page+1)*perPage:current.length===perPage;}
    else {if(!Array.isArray(r.data))throw new Error('Dataset query failed');current=r.data;more=current.length===perPage;}
    rows.push(...current);if(!more)break;if(page===maxPages-1)partial=true;
  }
  const result=normalizeCivic(rows,input,c);return {data:result.data,partial:partial||result.partial,fetchedAt};
}
function boundsFor(input:EventInput){const km=radius(input),dy=km/111.32,dx=dy/Math.max(.05,Math.cos(input.venue.lat!*Math.PI/180));return [Math.max(-180,input.venue.lng!-dx),Math.max(-90,input.venue.lat!-dy),Math.min(180,input.venue.lng!+dx),Math.min(90,input.venue.lat!+dy)];}

export function parseWzdx(raw:unknown,input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const root=obj(raw);if(root.type!=='FeatureCollection'||!Array.isArray(root.features))throw new Error('Not a WZDx feature collection');const info=obj(root.feed_info);
  const version=str(info.version);if(version&&!version.startsWith('4.'))throw new Error('This adapter supports WZDx 4.x');
  const updated=iso(info.update_date);let partial=!updated||Date.now()-new Date(updated).getTime()>(c.maxAgeHours??24)*3600000;
  const data:Conflict[]=[];
  for(const value of arr(root.features)){const r=obj(value),p=obj(r.properties),core=obj(p.core_details);const km=geometryDistance(input,r.geometry);if(!Number.isFinite(km)){partial=true;continue;}if(km>radius(input))continue;
    const startsAt=iso(p.start_date),endsAt=iso(p.end_date);if(!startsAt||!endsAt){partial=true;continue;}if(!during(input,startsAt,endsAt))continue;
    const roads=arr(core.road_names).map(v=>text(v)).join(', ');const moving=str(p.work_zone_type).includes('moving');
    data.push(finding(str(r.id)||hash(JSON.stringify(p)),c.id,c.name,c.publicUrl,{type:'road',title:`${core.event_type==='detour'?'Detour':'Roadworks'}${roads?` · ${roads}`:''}`,description:text(core.description)||`Published work zone. Vehicle impact: ${text(p.vehicle_impact)||'not specified'}.`,startsAt,endsAt,distanceKm:km,evidence:'official',timing:'scheduled',relevance:'overlap',resolutionEligible:!moving&&!partial,preference:'avoid',impact:'medium',observedAt:updated,caveat:moving?'Moving work zone: location can change.':'These are published planned dates; verified completion flags are not a forecast guarantee.'}));
  }return {data,partial};
}

export function parsePublicFeed(raw:string,input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const root=parseXml(raw);if(!descendants(root,'rss').length&&!descendants(root,'feed').length)throw new Error('Not RSS or Atom');let partial=false;const data:Conflict[]=[];
  for(const item of [...descendants(root,'item'),...descendants(root,'entry')]){
    const point=deepValue(item,'point').split(/\s+/).map(Number);let lat:unknown=deepValue(item,'lat'),lon:unknown=deepValue(item,'long');if(point.length===2&&point.every(Number.isFinite)){[lat,lon]=point;}
    let km=distance(input,lat,lon);
    if(km===undefined&&c.staticLocation)km=distance(input,c.staticLocation.lat,c.staticLocation.lng);
    if(km===undefined&&c.areaGeometry){const d=geometryDistance(input,c.areaGeometry);if(Number.isFinite(d))km=d;}
    if(km===undefined){partial=true;continue;}if(km>radius(input))continue;
    const observedAt=iso(value(item,'pubDate'))||iso(value(item,'published'))||iso(value(item,'updated'));
    if(observedAt&&Date.now()-new Date(observedAt).getTime()>(c.maxAgeHours??168)*3600000)continue;
    const title=text(value(item,'title'));const link=children(item,'link').find(l=>!l.attrs.rel||l.attrs.rel==='alternate');const url=safeUrl(link?.attrs.href||content(link))||c.publicUrl;
    if(!title)continue;
    data.push(finding(value(item,'guid')||value(item,'id')||hash(title+url),c.id,c.name,url,{type:c.type??'civic',title,description:text(value(item,'description')||value(item,'summary')||value(item,'content'),500),evidence:'official',timing:'unknown',distanceKm:km,observedAt,caveat:'This is a published notice, not a verified overlap. Read the source for the affected place, event time and current restrictions.'}));
  }return {data,partial};
}

export async function checkOpen311(input:EventInput,c:FeedConfig){
  const u=new URL(c.endpoint.replace(/\/$/,'')+'/requests.json');u.searchParams.set('status','open');u.searchParams.set('start_date',new Date(Date.now()-3*86400000).toISOString());u.searchParams.set('end_date',new Date().toISOString());
  if(c.jurisdictionId)u.searchParams.set('jurisdiction_id',c.jurisdictionId);if(c.serviceCodes?.length)u.searchParams.set('service_code',c.serviceCodes.join(','));
  const {data:raw,fetchedAt}=await feedRequest(c,'json',u.toString());if(!Array.isArray(raw))throw new Error('Not an Open311 request list');let partial=false;const data:Conflict[]=[];
  for(const r of raw.map(obj)){const km=distance(input,r.lat,r.long);if(km===undefined){partial=true;continue;}if(km>radius(input)||r.status==='closed')continue;
    data.push(finding(str(r.service_request_id),c.id,c.name,c.publicUrl,{type:'civic',title:text(r.service_name)||'Open public service request',description:'A public service request is still open in this area. A report is not confirmation of an incident or its severity.',timing:'live',evidence:'community',distanceKm:km,observedAt:iso(r.updated_datetime)||iso(r.requested_datetime),caveat:'Personal descriptions, images and reporter details are deliberately not displayed.'}));
  }
  return {data:data.slice(0,30),partial:partial||data.length>30,fetchedAt};
}
export function scopedGtfs(raw:Uint8Array,input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const feed=decodeGtfs(raw);if(feed.differential)throw new Error('Differential GTFS requires persistent state');if(!feed.version)throw new Error('GTFS version missing');
  if(!feed.timestamp||Date.now()-feed.timestamp*1000>(c.maxAgeHours??1)*3600000||feed.timestamp*1000>Date.now()+300000)throw new Error('GTFS feed timestamp is missing or stale');
  let partial=false;const mapping=c.gtfs!;const alerts:TransitAlert[]=[];
  for(const alert of feed.alerts){const selectors=alert.informed_entity??[];if(!selectors.length){partial=true;continue;}
    const relevant=selectors.some(s=>{
      if(s.trip_id||s.route_type!==undefined||s.direction_id!==undefined){partial=true;return false;}
      if(s.stop_id&&!mapping.stopIds?.includes(s.stop_id))return false;
      if(s.route_id&&!mapping.routeIds?.includes(s.route_id))return false;
      if(s.agency_id&&!mapping.agencyIds?.includes(s.agency_id))return false;
      if(s.stop_id||s.route_id)return true;
      return !!s.agency_id&&mapping.wholeAgencyArea===true&&!!c.areaGeometry&&geometryDistance(input,c.areaGeometry)===0;
    });if(relevant)alerts.push(alert);
  }
  return {data:transitFindings(alerts,input,{id:c.id,name:c.name,url:c.publicUrl}).map(x=>({...x,observedAt:new Date(feed.timestamp!*1000).toISOString()})),partial};
}

export async function checkRegionalFeed(input:EventInput,c:FeedConfig):Promise<CheckResult>{
  if(c.auth&&!process.env[c.auth.env])return outcome(c.id,c.name,c.publicUrl,'not_configured',[],'Feed credentials are not configured');
  const isCurrent=['rss','atom','open311'].includes(c.kind)||c.timeMode==='published'||c.timeMode==='current';
  if(isCurrent&&!currentEvent(input,Date.now(),72))return outcome(c.id,c.name,c.publicUrl,'not_applicable',[],'Current notices only; check closer to the event',{scope:'current'});
  try{
    let result:{data:Conflict[];partial?:boolean;fetchedAt?:string};
    if(['arcgis','socrata','ckan'].includes(c.kind))result=await queryCivic(input,c);
    else if(c.kind==='open311')result=await checkOpen311(input,c);
    else {
      const format=c.kind==='gtfs'?'bytes':c.kind==='wzdx'?'json':'text';const r=await feedRequest(c,format);
      if(c.kind==='cap'||c.kind==='meteoalarm'){
        const docs=[r.data as string];let parsed=parseCapDocuments(docs,input,c);let missing=parsed.links.length>0&&!c.followCapLinks;
        if(c.followCapLinks&&parsed.links.length){const extra=await mapLimit(parsed.links.slice(0,12),2,async url=>{try{const r=await feedRequest(c,'text',url);return r.data as string;}catch{missing=true;return undefined;}});docs.push(...extra.filter((x):x is string=>!!x));if(parsed.links.length>12)missing=true;parsed=parseCapDocuments(docs,input,c);}
        result={data:parsed.data,partial:parsed.partial||missing,fetchedAt:r.fetchedAt};
      }else if(c.kind==='gtfs')result={...scopedGtfs(r.data as Uint8Array,input,c),fetchedAt:r.fetchedAt};
      else if(c.kind==='wzdx')result={...parseWzdx(r.data,input,c),fetchedAt:r.fetchedAt};
      else if(c.kind==='datex')result={...parseDatex(r.data as string,input,c),fetchedAt:r.fetchedAt};
      else if(c.kind==='ics')result={...parseIcal(r.data as string,input,c),fetchedAt:r.fetchedAt};
      else result={...parsePublicFeed(r.data as string,input,c),fetchedAt:r.fetchedAt};
    }
    const truncated=result.data.length>50;const data=result.data.slice(0,50).map(x=>({...x,retrievedAt:result.fetchedAt}));
    return outcome(c.id,c.name,c.publicUrl,result.partial||truncated?'partial':'checked',data,result.partial?'Some records or coverage could not be confirmed':undefined,{fetchedAt:result.fetchedAt,scope:isCurrent?'current':'event',limitations:[c.attribution,...(truncated?['The report is limited to 50 findings from this feed.']:[])]});
  }catch(error){return failure(c.id,c.name,c.publicUrl,error);}
}
export async function checkRegional(input:EventInput):Promise<CheckResult[]>{
  const registry=configuredFeeds();const applicable=registry.filter(c=>feedApplies(c,input));const results=await mapLimit(applicable,3,c=>checkRegionalFeed(input,c));
  const families=['meteoalarm','cap','gtfs','datex','wzdx','arcgis','socrata','ckan','open311','feeds'];
  for(const family of families){if(!applicable.some(c=>feedFamily(c)===family))results.push(skip(family,'No local feed connected','not_configured'));}
  // Discovery never counts as an actual event/incident check.
  const p=provider('mobilitydb');results.push(outcome(p.id,p.name,p.docs,'not_applicable',[],'Feed discovery only',{scope:'discovery'}));
  return results;
}
