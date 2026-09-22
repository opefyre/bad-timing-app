/** Administrator-only discovery. No discovered URL is automatically executed as an event feed. */
import {getJson,getText} from '../http';
import {parseCsv} from '../parsers/csv';
import {arr,obj,str,safeUrl,text} from './util';
import {assertFeedUrl} from './feed-http';
import {FeedConfig} from './feed-config';
export function mobilityRows(csv:string,country:string){
 const rows=parseCsv(csv);const index=new Map(rows.map(r=>[r.id,r]));const cc=country.toUpperCase();
 if(!/^[A-Z]{2}$/.test(cc))throw new Error('Use a two-letter country code');
 return rows.filter(r=>r.data_type==='gtfs-rt'&&r.entity_type?.split('|').includes('sa')&&!['deprecated','inactive','development'].includes(r.status)).flatMap(r=>{
  const related=(r.static_reference||r.static_reference_ids||'').split('|').map(id=>index.get(id)).filter(Boolean);
  const locations=[r,...related];if(!locations.some(s=>s?.['location.country_code']===cc))return [];
  const direct=safeUrl(r['urls.direct_download']||r['urls.direct_download_url']);if(!direct)return [];
  return [{id:r.id,name:r.name||r.provider,provider:r.provider,endpoint:direct,staticReferences:related.map(s=>s!.id),country:cc,official:r.is_official||'Unknown',licence:safeUrl(r['urls.license']||r['urls.license_url']),authenticationType:r['urls.authentication_type']||'0',authenticationInfo:safeUrl(r['urls.authentication_info_url']),keyParameter:r['urls.api_key_parameter_name']||undefined,configured:false,required:'Confirm licence, identify feed stop/route IDs and map a local catchment in src/config/feeds.json.'}];
 });
}
export async function discoverMobility(country:string){const {data}=await getText('https://files.mobilitydatabase.org/feeds_v2.csv',3600000);return mobilityRows(data,country);}
export async function checkMobilityAccount(){
 const refresh=process.env.MOBILITY_DATABASE_REFRESH_TOKEN;if(!refresh)throw new Error('MOBILITY_DATABASE_REFRESH_TOKEN is not set');
 const {data}=await getJson('https://api.mobilitydatabase.org/v1/tokens',0,{'Content-Type':'application/json'},{method:'POST',body:JSON.stringify({refresh_token:refresh})});
 const access=str(obj(data).access_token);if(!access)throw new Error('The token response did not contain an access token');
 await getJson('https://api.mobilitydatabase.org/v1/metadata',0,{Authorization:`Bearer ${access}`});
 return {authenticated:true,message:'Metadata endpoint accepted the access token. Token values are not printed.'};
}
export async function discoverArcgis(query:string){
 if(!query.trim()||query.length>200)throw new Error('Use a short city/topic query');
 const params=new URLSearchParams({f:'json',q:`access:public AND type:"Feature Service" AND (${query})`,num:'50',sortField:'modified',sortOrder:'desc'});
 const {data}=await getJson(`https://www.arcgis.com/sharing/rest/search?${params}`,3600000);const r=obj(data);if(!Array.isArray(r.results)||r.error)throw new Error('Unexpected ArcGIS catalogue response');
 return {total:r.total,truncated:Number(r.nextStart)>0,results:arr(r.results).map(obj).map(v=>({id:v.id,title:text(v.title),owner:v.owner,url:safeUrl(v.url),metadata:`https://www.arcgis.com/sharing/rest/content/items/${encodeURIComponent(str(v.id))}?f=json`,required:'Inspect service layers, coordinate system, time fields, licence and area before configuring.'}))};
}
export async function discoverCkan(portal:string,query:string){
 const u=new URL(portal);u.pathname='/api/3/action/package_search';u.search=new URLSearchParams({q:query.slice(0,200),rows:'50'}).toString();
 const config={endpoint:new URL(portal).origin} as FeedConfig;await assertFeedUrl(u.toString(),config);
 const {data}=await getJson(u.toString(),3600000);const root=obj(data),r=obj(root.result);if(root.success!==true||!Array.isArray(r.results))throw new Error('CKAN catalogue request was not successful');
 return {total:r.count,results:arr(r.results).map(obj).map(v=>({id:v.id,title:text(v.title),licence:v.license_url||v.license_title,resources:arr(v.resources).map(obj).map(x=>({id:x.id,name:text(x.name),format:x.format,url:safeUrl(x.url),dataStore:x.datastore_active===true})),required:'Only DataStore-enabled resources can use the CKAN row adapter. Map fields and geography explicitly.'}))};
}
export async function discoverWzdx(){
 const {data}=await getJson('https://data.transportation.gov/resource/69qe-yiui.json?$limit=500',3600000);
 if(!Array.isArray(data))throw new Error('Unexpected WZDx registry response');
 return {registry:'https://data.transportation.gov/d/69qe-yiui',records:data,required:'Inspect publisher licence and current feed version, then configure a bounded WZDx feed. No feed has been enabled automatically.'};
}
