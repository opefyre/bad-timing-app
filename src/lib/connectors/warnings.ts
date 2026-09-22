import { Conflict,EventInput } from '@/types';
import { getJson,getText } from '../http';
import { parseXml,descendants,value,deepValue } from '../parsers/xml';
import { arr,obj,str,text,safeUrl,iso,hash,distance,during,currentEvent,finding,windowFor } from './util';
import { run,identity,skip } from './base';
import { provider } from './catalog';
const norm=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\b(district|distrito|de)\b/g,'').trim();
export async function checkIpma(input:EventInput){
  if(input.venue.countryCode?.toUpperCase()==='PT'&&windowFor(input).end.getTime()>Date.now()+3*86400000)return skip('ipma','Warnings are published only a few days ahead','out_of_range');
  return run('ipma',input,async()=>{
    const [{data:places},{data:raw,fetchedAt}]=await Promise.all([getJson('https://api.ipma.pt/open-data/distrits-islands.json',86400000),getJson('https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json',300000)]);
    if(!Array.isArray(raw)||!Array.isArray(obj(places).data))throw new Error('Unexpected warnings response');
    const state=norm(input.venue.state??'');const code=input.venue.subdivisionCode?.match(/^(?:PT-)?(\d{2})$/)?.[1];
    const district=code&&Number(code)>=1&&Number(code)<=18?Number(code):undefined;
    const rows=arr(obj(places).data).map(obj);
    let matches=rows.filter(r=>norm(str(r.local))===state||norm(str(r.local))===norm(input.venue.city??'')||district!==undefined&&Number(r.idDistrito)===district);
    if(!matches.length&&Number.isFinite(input.venue.lat)&&Number.isFinite(input.venue.lng)){
      // Geocoders return localised or English names; resolve the district from the nearest IPMA municipality.
      let nearest:number|undefined,best=Infinity;
      for(const r of rows){const km=distance(input,str(r.latitude),str(r.longitude));if(km!==undefined&&km<best){best=km;nearest=Number(r.idDistrito);}}
      if(nearest!==undefined)matches=rows.filter(r=>Number(r.idDistrito)===nearest);
    }
    const codes=new Set(matches.map(r=>str(r.idAreaAviso)));if(!codes.size)return {data:[],partial:true,message:'Warning district could not be matched reliably'};
    const data:Conflict[]=[];
    for(const r of raw.map(obj)){if(!codes.has(str(r.idAreaAviso))||!['yellow','orange','red'].includes(str(r.awarenessLevelID)))continue;
      const startsAt=iso(r.startTime,true),endsAt=iso(r.endTime,true);if(!during(input,startsAt,endsAt))continue;
      data.push(finding(hash(`${r.idAreaAviso}:${r.awarenessTypeName}:${startsAt}`),'ipma','IPMA',provider('ipma').website,{type:'warning',title:`${text(r.awarenessLevelID)} warning · ${text(r.awarenessTypeName)}`,description:text(r.text)||'Official warning for the venue’s district.',impact:r.awarenessLevelID==='red'?'high':'medium',preference:'avoid',startsAt,endsAt,timing:'forecast',evidence:'official',relevance:'overlap',resolutionEligible:false,areaLabel:input.venue.state,publisherSeverity:str(r.awarenessLevelID),retrievedAt:fetchedAt,caveat:'Follow the official guidance. A suggested time is not a safety clearance.'}));
    }return {data,fetchedAt};
  },{when:input.venue.countryCode?.toUpperCase()==='PT',reason:'Portugal only'});
}
export async function checkNws(input:EventInput){
  return run('nws',input,async()=>{
    const params=new URLSearchParams({active:'true',point:`${input.venue.lat},${input.venue.lng}`});
    const {data:raw,fetchedAt}=await getJson(`https://api.weather.gov/alerts?${params}`,120000,{'User-Agent':identity(),Accept:'application/geo+json'});const root=obj(raw);
    if(!Array.isArray(root.features))throw new Error('Unexpected warnings response');const data:Conflict[]=[];
    for(const r of arr(root.features).map(obj)){const p=obj(r.properties);if(p.status&&p.status!=='Actual'||p.messageType==='Cancel')continue;
      const startsAt=iso(p.onset)||iso(p.effective),endsAt=iso(p.ends)||iso(p.expires);const w=windowFor(input);
      if(startsAt&&new Date(startsAt)>=w.end||endsAt&&new Date(endsAt)<=w.start)continue;
      data.push(finding(str(p.id)||str(r.id)||hash(str(p.headline)),'nws','US National Weather Service',safeUrl(p.web)||'https://www.weather.gov/',{type:'warning',title:text(p.headline)||text(p.event),description:text(p.description,650),impact:['Extreme','Severe'].includes(str(p.severity))?'high':'medium',preference:'avoid',evidence:'official',startsAt,endsAt,timing:'forecast',relevance:during(input,startsAt,endsAt)?'overlap':'context',resolutionEligible:false,areaLabel:text(p.areaDesc),publisherSeverity:text(p.severity),certainty:text(p.certainty),observedAt:iso(p.sent),retrievedAt:fetchedAt,caveat:text(p.instruction,400)||'Follow official local instructions. This is not a safety clearance.'}));
    }return {data,scope:'current' as const,fetchedAt,limitations:['Active published warnings only; absence does not establish future warning coverage.']};
  },{when:['US','PR','GU','VI','AS','MP'].includes(input.venue.countryCode?.toUpperCase()??'')&&currentEvent(input,Date.now(),72),reason:'US active warnings only; check closer to the event',live:true});
}
export async function checkGdacs(input:EventInput){
  return run('gdacs',input,async()=>{
    const {data:raw,fetchedAt}=await getText('https://www.gdacs.org/xml/rss.xml',600000);const root=parseXml(raw);const items=descendants(root,'item');
    if(!descendants(root,'channel').length)throw new Error('Unexpected GDACS feed');const data:Conflict[]=[];let partial=false;
    for(const item of items){const km=distance(input,deepValue(item,'lat'),deepValue(item,'long'));if(km===undefined){partial=true;continue;}if(km>100)continue;
      const title=value(item,'title');const url=safeUrl(value(item,'link'))||provider('gdacs').website;const date=iso(deepValue(item,'fromdate'))||iso(value(item,'pubDate'));
      data.push(finding(deepValue(item,'eventid')||hash(title),'gdacs','GDACS',url,{type:'hazard',title:text(title),description:text(value(item,'description')),evidence:'official',timing:'live',observedAt:date,distanceKm:km,retrievedAt:fetchedAt,publisherSeverity:text(deepValue(item,'alertlevel')),caveat:'Regional disaster summary. Distance to the reported location is not the distance to a hazard boundary.'}));
    }return {data,partial,scope:'current' as const,fetchedAt};
  },{when:currentEvent(input,Date.now(),72),reason:'Current disaster context only',live:true});
}
