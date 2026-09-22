import { Conflict, EventInput } from '@/types';
import registry from '@/config/feeds.json';
import { geometryDistance } from '../parsers/geometry';
import { radius } from './util';
export type FeedKind='cap'|'meteoalarm'|'gtfs'|'datex'|'wzdx'|'arcgis'|'socrata'|'ckan'|'open311'|'rss'|'atom'|'ics';
export interface FeedConfig {
  id:string; kind:FeedKind; enabled:boolean; name:string;
  endpoint:string; publicUrl:string; licenceUrl:string; attribution:string;
  countries:string[]; bounds?:[number,number,number,number]; timezone?:string;
  /** Every followed CAP URL must remain on an explicitly approved host. */
  allowedHosts?:string[]; followCapLinks?:boolean;
  /** Secret values are environment references, never values in this file. */
  auth?:{env:string;header?:string;query?:string;prefix?:string};
  staticLocation?:{lat:number;lng:number;name?:string};
  /** Geographic area of a country/citywide notice, only when publisher really means this whole area. */
  areaGeometry?:unknown;
  capGeocodes?:Record<string,unknown>;
  ttlSeconds?:number; maxAgeHours?:number;
  fields?:{id:string;title:string;description?:string;start?:string;end?:string;lat?:string;lon?:string;geometry?:string;url?:string;updated?:string;status?:string};
  type?:Conflict['type']; timeMode?:'scheduled'|'current'|'published'; dateOnlyEndInclusive?:boolean;
  cancelledValues?:string[]; where?:string; orderBy?:string;
  datasetId?:string; resourceId?:string; jurisdictionId?:string;
  serviceCodes?:string[]; limit?:number; pageLimit?:number;
  /** Mandatory scope mapping for GTFS. IDs are from that feed, not global IDs. */
  gtfs?:{stopIds?:string[];routeIds?:string[];agencyIds?:string[];wholeAgencyArea?:boolean};
}
const kinds:FeedKind[]=['cap','meteoalarm','gtfs','datex','wzdx','arcgis','socrata','ckan','open311','rss','atom','ics'];
export function validateFeeds(raw:unknown):FeedConfig[]{
  if(!Array.isArray(raw))throw new Error('Feed registry must be an array');
  const seen=new Set<string>();
  return raw.map(value=>{
    const c=value as FeedConfig;
    if(!c||typeof c!=='object'||!/^[-a-z0-9:]{3,100}$/.test(c.id)||seen.has(c.id))throw new Error('Invalid or duplicate feed ID');seen.add(c.id);
    if(!kinds.includes(c.kind)||typeof c.enabled!=='boolean'||!c.name||!c.attribution)throw new Error(`Invalid feed metadata: ${c.id}`);
    for(const target of [c.endpoint,c.publicUrl,c.licenceUrl]){const u=new URL(target);if(u.protocol!=='https:'||u.username||u.password)throw new Error(`HTTPS required: ${c.id}`);}
    if(!Array.isArray(c.countries)||!c.countries.length||c.countries.some(x=>! /^[A-Z]{2}$/.test(x)))throw new Error(`Country scope required: ${c.id}`);
    if(c.bounds&&(c.bounds[0]<-180||c.bounds[2]>180||c.bounds[1]<-90||c.bounds[3]>90||c.bounds.length!==4||c.bounds.some(x=>!Number.isFinite(x))||c.bounds[0]>=c.bounds[2]||c.bounds[1]>=c.bounds[3]))throw new Error(`Invalid area: ${c.id}`);
    if(c.auth&&(!/^[A-Z][A-Z0-9_]+$/.test(c.auth.env)||(!c.auth.header&&!c.auth.query)||!!c.auth.header===!!c.auth.query))throw new Error(`Invalid credential reference: ${c.id}`);
    if(c.timezone)new Intl.DateTimeFormat('en',{timeZone:c.timezone});
    if(['arcgis','socrata','ckan'].includes(c.kind)&&!c.fields)throw new Error(`Field mapping required: ${c.id}`);
    if(c.kind==='socrata'&&(!c.datasetId||!c.auth))throw new Error(`SODA3 requires dataset and token: ${c.id}`);
    if(c.kind==='ckan'&&!c.resourceId)throw new Error(`DataStore resource required: ${c.id}`);
    if(c.kind==='gtfs'&&(!c.gtfs||!c.bounds&&!c.areaGeometry))throw new Error(`GTFS scope mapping and catchment bounds required: ${c.id}`);
    if(c.staticLocation&&(!Number.isFinite(c.staticLocation.lat)||Math.abs(c.staticLocation.lat)>90||!Number.isFinite(c.staticLocation.lng)||Math.abs(c.staticLocation.lng)>180))throw new Error(`Invalid location: ${c.id}`);
    if(c.fields)for(const field of Object.values(c.fields)){if(field&&!/^[\w.:-]+$/.test(field))throw new Error(`Invalid field: ${c.id}`);}
    if(c.pageLimit!==undefined&&(!Number.isInteger(c.pageLimit)||c.pageLimit<1||c.pageLimit>5))throw new Error(`Page limit must be 1–5: ${c.id}`);
    return c;
  });
}
export const configuredFeeds=()=>validateFeeds(registry);
export function feedApplies(c:FeedConfig,input:EventInput):boolean{
  if(!c.enabled||!c.countries.includes(input.venue.countryCode?.toUpperCase()??''))return false;
  if(c.bounds){const [w,s,e,n]=c.bounds,lat=input.venue.lat!,lon=input.venue.lng!;if(lat<s||lat>n||lon<w||lon>e)return false;}
  if(c.staticLocation&&geometryDistance(input,{type:'Point',coordinates:[c.staticLocation.lng,c.staticLocation.lat]})>radius(input))return false;
  return true;
}
export const feedFamily=(c:FeedConfig)=>['rss','atom','ics'].includes(c.kind)?'feeds':c.kind;
