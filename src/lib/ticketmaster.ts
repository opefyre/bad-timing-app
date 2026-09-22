import { CheckResult, EventInput } from '@/types';
import { getJson } from './http';
import { geohash } from './geo';
import { run, skip, commercial } from './connectors/base';
import { arr,obj,str,text,iso,distance,radius,windowFor,during,finding } from './connectors/util';
import { addLocalDays,zonedLocalToUtc } from './time';
export function ticketmasterDate(date:Date){return date.toISOString().replace(/\.\d{3}Z$/,'Z');}
export async function checkTicketmaster(input:EventInput):Promise<CheckResult>{
 if(commercial()&&process.env.TICKETMASTER_COMMERCIAL_PERMISSION!=='true')return skip('ticketmaster','Permission required for commercial use','disabled');
 return run('ticketmaster',input,async()=>{
  const day=input.dateTime.slice(0,10)+'T00:00';
  const from=zonedLocalToUtc(addLocalDays(day,-1),input.venue.timezone!),to=zonedLocalToUtc(addLocalDays(day,2),input.venue.timezone!);
  const u=new URL('https://app.ticketmaster.com/discovery/v2/events.json');u.searchParams.set('apikey',process.env.TICKETMASTER_API_KEY!);u.searchParams.set('geoPoint',geohash(input.venue.lat!,input.venue.lng!));u.searchParams.set('radius',String(radius(input)));u.searchParams.set('unit','km');u.searchParams.set('startEndDateTime',`${ticketmasterDate(from)},${ticketmasterDate(to)}`);u.searchParams.set('size','100');u.searchParams.set('sort','distance,asc');
  const response=await getJson(u.toString(),600000);const root=obj(response.data);
  if(root.errors||(!root.page&&!root._embedded))throw new Error('Unexpected event response');
  const events=arr(obj(root._embedded).events);const w=windowFor(input);let partial=Number(obj(root.page).totalElements)>events.length;
  const data=events.flatMap(raw=>{const e=obj(raw),dates=obj(e.dates),start=obj(dates.start),end=obj(dates.end),venue=obj(arr(obj(e._embedded).venues)[0]),location=obj(venue.location);
   if(['cancelled','postponed','rescheduled'].includes(str(obj(dates.status).code)))return [];
   const d=distance(input,location.latitude,location.longitude);if(d===undefined){partial=true;return [];}if(d>radius(input))return [];
   const startsAt=start.dateTBD||start.timeTBA||start.noSpecificTime?undefined:iso(start.dateTime),endsAt=iso(end.dateTime);
   const overlap=during(input,startsAt,endsAt);
   const nearbyTime=startsAt&&new Date(startsAt).getTime()>=w.start.getTime()-6*3600000&&new Date(startsAt)<=w.end;
   const sameUnknownDay=!startsAt&&str(start.localDate)===input.dateTime.slice(0,10);
   if(!overlap&&!nearbyTime&&!sameUnknownDay)return [];
   return [finding(str(e.id),'ticketmaster',text(e.name),'https://www.ticketmaster.com/',{type:'nearby_event',source:'Ticketmaster',sourceUrl:str(e.url),description:text(venue.name),placeName:text(venue.name),distanceKm:d,startsAt,endsAt,evidence:'structured',timing:startsAt?'scheduled':'unknown',relevance:overlap?'overlap':'context',resolutionEligible:!!(startsAt&&endsAt&&overlap),impact:d<1.5?'medium':'low',caveat:!endsAt?'The listing does not publish an end time. No crowd estimate is inferred.':undefined})];
  });return {data,partial,fetchedAt:response.fetchedAt,message:partial?'Only the first 100 listings were checked.':undefined};
 },{key:'TICKETMASTER_API_KEY'});
}
