import { Conflict, EventInput } from '@/types';
import { getJson,getText } from '../http';
import { addLocalDays,zonedLocalToUtc } from '../time';
import { geometryDistance } from '../parsers/geometry';
import { parseCsv } from '../parsers/csv';
import { arr,obj,str,num,text,safeUrl,iso,hash,bounds,distance,radius,windowFor,during,currentEvent,finding } from './util';
import { commercial,run,skip } from './base';
import { provider } from './catalog';
const DAY=86400000;
const label=(v:unknown)=> { const names=arr(v).map(obj);return text(names.find(x=>str(x.language).toUpperCase()==='EN')?.text??names[0]?.text); };
const tick=()=>Math.floor(Date.now()/300000)*300000;
const recent=(days:number)=>new Date(tick()-days*DAY).toISOString();
const dateOnly=(d:string)=>d.slice(0,10);

export async function checkOpenHolidays(input:EventInput) {
  return run('openholidays',input,async()=>{
    const root='https://openholidaysapi.org'; const cc=input.venue.countryCode!.toUpperCase();
    const {data:raw}=await getJson(`${root}/Countries`,DAY);
    if(!Array.isArray(raw))throw new Error('Unexpected country response');
    const country=raw.map(obj).find(c=>c.isoCode===cc);
    if(!country)return {data:[],partial:true,message:'Country is not in this holiday catalogue'};
    const start=input.dateTime.slice(0,10);const end=addLocalDays(input.dateTime,Math.ceil(input.durationMinutes/1440)).slice(0,10);
    // Fetch calendar years, not just an empty event-day slice. An unpublished year
    // must not look like a confirmed holiday-free day. This also reuses the
    // same cached responses when comparing nearby dates.
    const years=[...new Set([start.slice(0,4),end.slice(0,4)])];
    const datasets=await Promise.allSettled(years.flatMap(year=>['PublicHolidays','SchoolHolidays'].map(async kind=>{
      const params=new URLSearchParams({countryIsoCode:cc,languageIsoCode:'EN',validFrom:`${year}-01-01`,validTo:`${year}-12-31`});
      return {kind,...await getJson(`${root}/${kind}?${params}`,DAY)};
    })));
    let partial=false;const data:Conflict[]=[];
    for(const response of datasets){
      if(response.status==='rejected'){partial=true;continue;}
      const {kind,data:raw,fetchedAt}=response.value;
      if(!Array.isArray(raw)||!raw.length){partial=true;continue;}
      for(const value of raw){const h=obj(value);const name=label(h.name)||kind;
        const a=str(h.startDate).slice(0,10),b=str(h.endDate).slice(0,10);
        if(!/^\d{4}-\d{2}-\d{2}$/.test(a)||!/^\d{4}-\d{2}-\d{2}$/.test(b)){partial=true;continue;}
        if(b<start||a>end)continue;
        const regions=arr(h.subdivisions).map(obj);const groups=arr(h.groups);
        const state=(input.venue.state??'').toLowerCase();const code=input.venue.subdivisionCode?.toUpperCase();
        const matches=regions.some(r=> (code&&[str(r.code).toUpperCase(),str(r.isoCode).toUpperCase()].includes(code)) || (state&&label(r.name).toLowerCase()===state));
        if(!h.nationwide&&!matches){partial=true;continue;}
        const startsAt=zonedLocalToUtc(`${a}T00:00`,input.venue.timezone!).toISOString();
        const endsAt=zonedLocalToUtc(addLocalDays(`${b}T00:00`,1),input.venue.timezone!).toISOString();
        if(!during(input,startsAt,endsAt))continue;
        data.push(finding(str(h.id)||hash(`${name}:${a}`),'openholidays','OpenHolidays',provider('openholidays').website,{type:'holiday',title:name,description:kind==='SchoolHolidays'?'Published school holiday. Individual schools and school groups can differ.':'Published public holiday. This does not establish anyone’s availability.',startsAt,endsAt,timing:'scheduled',resolutionEligible:groups.length===0,relevance:groups.length?'context':'overlap',evidence:'structured',areaLabel:h.nationwide?cc:input.venue.state,retrievedAt:fetchedAt,caveat:groups.length?'This calendar may apply only to particular school groups.':undefined}));
        if(groups.length)partial=true;
      }
    }
    return {data,partial,message:partial?'Some calendar-year, regional or school-group coverage could not be confirmed':undefined};
  },{when:!!input.venue.countryCode});
}

export async function checkEonet(input:EventInput){
  return run('eonet',input,async()=>{
    const km=Math.max(25,radius(input)); const [w,s,e,n]=bounds(input,km);
    const {data:raw,fetchedAt}=await getJson(`https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30&limit=100&bbox=${w},${n},${e},${s}`,900000);
    const root=obj(raw);if(!Array.isArray(root.events))throw new Error('Unexpected event response');
    const data:Conflict[]=[];let incomplete=false;
    for(const value of arr(root.events)){const r=obj(value);const geometry=arr(r.geometry).map(obj).sort((a,b)=>str(b.date).localeCompare(str(a.date)))[0];if(!geometry){incomplete=true;continue;}
      const km=geometryDistance(input,geometry);if(!Number.isFinite(km)){incomplete=true;continue;}if(km>Math.max(25,radius(input)))continue;
      const links=arr(r.sources).map(obj);const url=safeUrl(links[0]?.url)||provider('eonet').website;
      data.push(finding(str(r.id),'eonet','NASA EONET',url,{type:'hazard',title:text(r.title),description:'An open natural event is listed in the surrounding area. Its mapped observation is not a confirmed hazard boundary.',evidence:'observed',timing:'live',observedAt:iso(geometry.date),distanceKm:km,retrievedAt:fetchedAt,relatedSources:links.map(l=>({name:text(l.id),url:safeUrl(l.url)||url})),caveat:'Check the local authority for current restrictions. Moving the gathering does not establish that this is resolved.'}));
    }
    return {data,scope:'current' as const,partial:incomplete||arr(root.events).length>=100,fetchedAt};
  },{when:currentEvent(input,Date.now(),72),reason:'Recent observations only; check closer to the event',live:true});
}

export async function checkFirms(input:EventInput){
  return run('firms',input,async()=>{
    const box=bounds(input,Math.max(10,radius(input))).join(',');
    const {data:raw,fetchedAt}=await getText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(process.env.FIRMS_MAP_KEY!)}/VIIRS_SNPP_NRT/${box}/2`,900000);
    if(!raw.startsWith('latitude,'))throw new Error('Unexpected hotspot response');
    const rows=parseCsv(raw);const data:Conflict[]=[];
    for(const r of rows){const d=distance(input,r.latitude,r.longitude);if(d===undefined||d>Math.max(10,radius(input)))continue;
      const time=r.acq_time?.padStart(4,'0');const observedAt=iso(`${r.acq_date}T${time?.slice(0,2)}:${time?.slice(2)}:00Z`);
      if(!observedAt)continue;
      data.push(finding(hash(`${r.latitude}:${r.longitude}:${observedAt}`),'firms','NASA FIRMS',provider('firms').website,{type:'hazard',title:'Satellite heat detection',description:`VIIRS detected a hotspot ${d.toFixed(1)} km from the venue. A hotspot is not necessarily a wildfire.`,evidence:'observed',timing:'live',observedAt,distanceKm:d,retrievedAt:fetchedAt,caveat:'Satellite coverage is incomplete. Use official local alerts for fire restrictions or evacuation instructions.'}));
    }
    return {data:data.slice(0,30),scope:'current' as const,partial:data.length>30,fetchedAt};
  },{key:'FIRMS_MAP_KEY',when:input.isOutdoor&&currentEvent(input,Date.now(),48),reason:'Recent outdoor observations only',live:true});
}

export async function checkUsgs(input:EventInput){
  return run('usgs',input,async()=>{
    const query=new URLSearchParams({format:'geojson',latitude:String(input.venue.lat),longitude:String(input.venue.lng),maxradiuskm:'100',starttime:recent(2),endtime:new Date(tick()).toISOString(),minmagnitude:'3',limit:'100',orderby:'time'});
    const {data:raw,fetchedAt}=await getJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${query}`,300000);const root=obj(raw);
    if(!Array.isArray(root.features))throw new Error('Unexpected earthquake response');
    const data=arr(root.features).map(value=>{const r=obj(value),p=obj(r.properties),coords=arr(obj(r.geometry).coordinates);const km=distance(input,coords[1],coords[0]);
      return finding(str(r.id),'usgs','USGS',safeUrl(p.url)||provider('usgs').website,{type:'hazard',title:text(p.title)||'Recent earthquake',description:'A recent recorded earthquake in the region. This is an observation, not a forecast or an assessment of your venue.',timing:'live',evidence:'observed',distanceKm:km,observedAt:iso(num(p.time)),retrievedAt:fetchedAt});
    });
    return {data,scope:'current' as const,partial:data.length>=100,fetchedAt};
  },{when:currentEvent(input,Date.now(),48),reason:'Recent observations only',live:true});
}

export async function checkGdelt(input:EventInput){
  return run('gdelt',input,async()=>{
    const clean=(s:string)=>s.replace(/[^\p{L}\p{N} \-]/gu,' ').trim().slice(0,100);
    const place=[input.venue.city,input.venue.countryName].filter(Boolean).map(v=>`"${clean(v!)}"`).join(' ');
    const terms='(closure OR roadworks OR protest OR strike OR evacuation OR flood OR "state visit" OR festival OR maintenance)';
    const params=new URLSearchParams({query:`${place} ${terms}`,mode:'ArtList',format:'json',maxrecords:'15',sort:'DateDesc',timespan:'7d'});
    const {data:raw,fetchedAt}=await getJson(`https://api.gdeltproject.org/api/v2/doc/doc?${params}`,900000);
    const root=obj(raw);if(!Array.isArray(root.articles))throw new Error('Unexpected news response');
    const data=arr(root.articles).map(obj).filter(r=>safeUrl(r.url)).map(r=>{
      const seen=str(r.seendate).replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z');
      return finding(hash(str(r.url)),'gdelt',text(r.domain)||'GDELT',safeUrl(r.url)!,{type:'news',title:text(r.title,240),description:`News mentioning ${input.venue.city}. Read the original report to confirm the place, event date and current situation.`,evidence:'reported',timing:'unknown',areaLabel:input.venue.city,observedAt:iso(seen),retrievedAt:fetchedAt,caveat:'The publication time is not the incident time. No precise distance or event overlap has been established.'});
    });
    return {data,scope:'current' as const,partial:data.length>=15,fetchedAt,limitations:['Keyword-based city news is not a complete or verified incident register.']};
  },{when:input.includeNews===true&&!!input.venue.city,reason:input.includeNews?'City could not be resolved':'News is off',live:true});
}

export async function checkAirQuality(input:EventInput){
  if(commercial()&&!process.env.OPEN_METEO_API_KEY)return skip('airquality','Commercial API access is not configured','disabled');
  return run('airquality',input,async()=>{
    const host=process.env.OPEN_METEO_API_KEY?'customer-air-quality-api.open-meteo.com':'air-quality-api.open-meteo.com';
    const params=new URLSearchParams({latitude:String(input.venue.lat),longitude:String(input.venue.lng),hourly:'european_aqi,pm2_5,pm10',timezone:'GMT',timeformat:'unixtime',forecast_days:'5'});
    if(process.env.OPEN_METEO_API_KEY)params.set('apikey',process.env.OPEN_METEO_API_KEY);
    const {data:raw,fetchedAt}=await getJson(`https://${host}/v1/air-quality?${params}`,1800000);
    const root=obj(raw);if(root.error)throw new Error('Air quality request failed');const h=obj(root.hourly);if(!Array.isArray(h.time))throw new Error('Unexpected hourly response');
    const times=arr(h.time).map(t=>(num(t)??0)*1000);const w=windowFor(input);const selected=times.map((t,i)=>({t,i})).filter(x=>x.t<w.end.getTime()&&x.t+3600000>w.start.getTime());
    if(!selected.length)return {data:[],partial:true,message:'Air-quality forecast is not available for this date'};
    const aqi=arr(h.european_aqi);const values=selected.map(x=>num(aqi[x.i])).filter((x):x is number=>x!==undefined);const peak=Math.max(...values);
    const full=times[0]<=w.start.getTime()&&times[times.length-1]+3600000>=w.end.getTime()&&values.length===selected.length;
    const data:Conflict[]=[];
    if(values.length&&peak>40){const idx=selected.find(x=>num(aqi[x.i])===peak)!;const pm=num(arr(h.pm2_5)[idx.i]);
      data.push(finding(`aq:${dateOnly(input.dateTime)}`,'airquality','Open-Meteo / CAMS',provider('airquality').website,{type:'air_quality',policyKey:'airquality:elevated',title:'Elevated air-quality index forecast',description:`European AQI reaches ${Math.round(peak)} during the gathering${pm!==undefined?`; modelled PM2.5 is ${pm.toFixed(1)} µg/m³ at that hour`:''}. This is a regional model, not a measurement at the venue.`,impact:peak>60?'medium':'low',evidence:'observed',timing:'forecast',resolutionEligible:full,relevance:'overlap',startsAt:w.start.toISOString(),endsAt:w.end.toISOString(),retrievedAt:fetchedAt,caveat:'An informational flag, not medical advice or a safety threshold.'}));}
    return {data,partial:!full,fetchedAt,message:full?undefined:'Only part of the gathering has usable forecast data'};
  },{when:input.isOutdoor,reason:'Outdoor events only'});
}

export async function checkSeatGeek(input:EventInput){
  if(!process.env.SEATGEEK_CLIENT_SECRET)return skip('seatgeek','Client credentials are not configured','not_configured');
  return run('seatgeek',input,async()=>{
    const w=windowFor(input);const params=new URLSearchParams({lat:String(input.venue.lat),lon:String(input.venue.lng),range:`${(radius(input)/1.609344).toFixed(2)}mi`,'datetime_utc.gte':new Date(w.start.getTime()-6*3600000).toISOString().slice(0,19),'datetime_utc.lte':w.end.toISOString().slice(0,19),per_page:'100',page:'1',sort:'datetime_utc.asc'});
    const auth=Buffer.from(`${process.env.SEATGEEK_CLIENT_ID}:${process.env.SEATGEEK_CLIENT_SECRET??''}`).toString('base64');
    const {data:raw,fetchedAt}=await getJson(`https://api.seatgeek.com/2/events?${params}`,1800000,{Authorization:`Basic ${auth}`});const root=obj(raw);
    if(!Array.isArray(root.events))throw new Error('Unexpected event response');
    const data:Conflict[]=[];
    for(const value of arr(root.events)){const r=obj(value),v=obj(r.venue),loc=obj(v.location);const km=distance(input,loc.lat,loc.lon);if(km===undefined||km>radius(input))continue;
      const startsAt=r.date_tbd||r.time_tbd?undefined:iso(r.datetime_utc,true);
      data.push(finding(str(r.id),'seatgeek','SeatGeek',safeUrl(r.url)||provider('seatgeek').website,{type:'nearby_event',title:text(r.title),description:`Listed at ${text(v.name)||'a nearby venue'}${startsAt?' around your proposed time':''}. The listing does not provide a reliable end time.`,startsAt,distanceKm:km,placeName:text(v.name),timing:startsAt?'scheduled':'unknown',relevance:'context',resolutionEligible:false,retrievedAt:fetchedAt,caveat:'An unknown end time prevents a confirmed overlap or a claim that moving the start resolves it.'}));
    }
    return {data,partial:(num(obj(root.meta).total)??0)>100,fetchedAt};
  },{key:'SEATGEEK_CLIENT_ID'});
}

export async function checkRadar(input:EventInput){
  if(commercial()&&process.env.RADAR_COMMERCIAL_PERMISSION!=='true')return skip('radar','Commercial reuse permission is not configured','disabled');
  return run('radar',input,async()=>{
    const params=new URLSearchParams({location:input.venue.countryCode!.toUpperCase(),dateStart:recent(2),dateEnd:new Date(tick()).toISOString(),limit:'50',format:'JSON'});
    const {data:raw,fetchedAt}=await getJson(`https://api.cloudflare.com/client/v4/radar/annotations/outages?${params}`,600000,{Authorization:`Bearer ${process.env.CLOUDFLARE_RADAR_TOKEN}`});const root=obj(raw);
    if(root.success===false)throw new Error('Radar request failed');const result=obj(root.result);if(!Array.isArray(result.annotations))throw new Error('Unexpected outage response');
    const data=arr(result.annotations).map(obj).map(r=>finding(str(r.id)||hash(str(r.description)),'radar','Cloudflare Radar',safeUrl(r.linkedUrl)||provider('radar').website,{type:'internet',title:'Regional internet disruption reported',description:text(r.description),evidence:'observed',timing:'live',observedAt:iso(r.startDate),areaLabel:input.venue.countryCode,retrievedAt:fetchedAt,caveat:'Country/regional context only. This does not establish whether the venue or its internet provider is affected.'}));
    return {data,scope:'current' as const,partial:data.length>=50,fetchedAt};
  },{key:'CLOUDFLARE_RADAR_TOKEN',when:input.needsInternet===true&&!!input.venue.countryCode&&currentEvent(input,Date.now(),24),reason:'Enabled only for imminent events that need internet',live:true});
}
