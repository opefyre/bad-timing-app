import { CheckResult, EventInput, Report, SourceStatus } from '@/types';
import { geocodeVenue } from './geocoding';
import { checkTicketmaster } from './ticketmaster';
import { checkFootballData } from './football-data';
import { checkFootballAf } from './api-football';
import { checkWeather } from './weather';
import { checkDaylight } from './daylight';
import { checkTVmaze } from './tvmaze';
import { checkBankHolidays } from './bank-holidays';
import { checkTfLDisruptions } from './tfl';
import { checkOpenHolidays,checkEonet,checkFirms,checkUsgs,checkGdelt,checkAirQuality,checkSeatGeek,checkRadar } from './connectors/global';
import { checkTomTom,checkTransitland } from './connectors/transport';
import { checkIpma,checkNws,checkGdacs } from './connectors/warnings';
import { checkRegional } from './connectors/regional';
import { mapLimit,failure,outcome } from './connectors/util';
import { provider } from './connectors/catalog';
import { normalizeFindings,deduplicate } from './evidence';
import { possibleInstants } from './time';
import { InputError } from './validation';
export interface AnalysisContext { siteOrigin?:string }
export const CHECKS:Array<[string,(input:EventInput)=>Promise<CheckResult>]>=[
 ['ticketmaster',checkTicketmaster],['football',checkFootballData],['football-af',checkFootballAf],['tvmaze',checkTVmaze],['bank-holidays',checkBankHolidays],['weather',checkWeather],['daylight',checkDaylight],['tfl',checkTfLDisruptions],['tomtom',checkTomTom],['transitland',checkTransitland],['openholidays',checkOpenHolidays],['gdelt',checkGdelt],['ipma',checkIpma],['nws',checkNws],['gdacs',checkGdacs],['eonet',checkEonet],['firms',checkFirms],['usgs',checkUsgs],['airquality',checkAirQuality],['seatgeek',checkSeatGeek],['radar',checkRadar],
];
export function statusFor(r:CheckResult):SourceStatus{return {id:r.sourceId,name:r.source,url:r.url,state:r.state,checkedAt:r.lastChecked,message:r.message,scope:r.scope??'event',fetchedAt:r.fetchedAt,limitations:r.limitations,itemCount:r.data.length};}
export async function analyzeEvent(rawInput:EventInput,context:AnalysisContext={}):Promise<Report>{
 void context;
 let input={...rawInput,venue:{...rawInput.venue}};const now=new Date().toISOString();
 if(typeof input.venue.lat!=='number'||typeof input.venue.lng!=='number'||!input.venue.timezone||!input.venue.countryCode){
  try{const coordinates=Number.isFinite(input.venue.lat)&&Number.isFinite(input.venue.lng)?{lat:input.venue.lat!,lng:input.venue.lng!}:undefined;const venue=await geocodeVenue(input.venue.address,coordinates);input={...input,venue:{...venue,name:input.venue.name||venue.name}};}
  catch{throw new InputError('The location could not be matched. Choose a search result or check the location connection.');}
 }
 if(!input.venue.timezone)throw new InputError('The venue timezone could not be found. Choose another location.');
 let instants:Date[];try{instants=possibleInstants(input.dateTime,input.venue.timezone);}catch{throw new InputError('Check the venue timezone and event time.');}
 if(!instants.length)throw new InputError('That time is skipped when the clocks change. Choose another time.');
 const disabled=new Set((process.env.DISABLED_SOURCES??'').split(',').map(s=>s.trim()).filter(Boolean));
 const [results,regional]=await Promise.all([
  mapLimit(CHECKS,5,async([id,check])=>{const p=provider(id);if(disabled.has(id))return outcome(id,p.name,p.docs,'disabled',[],'Disabled by the app operator');try{return await check(input);}catch(e){return failure(id,p.name,p.docs,e);}}),
  disabled.has('regional')?Promise.resolve([]):checkRegional(input),
 ]);
 const all=[...results,...regional];
 const conflicts=deduplicate(all.flatMap(r=>normalizeFindings(r,input)));
 const sources:SourceStatus[]=[{id:'geoapify',name:'Geoapify',url:'https://www.geoapify.com/',state:'checked',scope:'event',checkedAt:now,message:'Selected location and timezone'},...all.map(statusFor)];
 const notices:string[]=[];
 if(instants.length>1)notices.push('The clocks change on this date. This report uses the first occurrence of your selected local time.');
 if(Math.abs(input.venue.lng!)>179||Math.abs(input.venue.lat!)>85)notices.push('Some area searches are limited near the date line or poles. Check local sources.');
 if(conflicts.some(c=>c.type==='warning'))notices.push('Follow the issuing authority’s current instructions. A suggested time is not safety clearance.');
 return {event:input,conflicts,sources,coverageGaps:sources.filter(s=>['partial','unavailable','out_of_range','not_configured'].includes(s.state)).map(s=>s.name),suggestions:[],checkedAt:new Date().toISOString(),notices};
}
