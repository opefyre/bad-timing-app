import { CheckResult, Conflict, EventInput } from '@/types';
import { getJson } from './http';
import { run,skip,identity } from './connectors/base';
import { arr,obj,num,str,windowFor,finding,outcome } from './connectors/util';
import { defaultPreference } from './preferences';
export function parseWeather(raw:unknown,input:EventInput):{data:Conflict[];partial:boolean;outside:boolean}{
 const series=arr(obj(obj(raw).properties).timeseries).map(obj).sort((a,b)=>Date.parse(str(a.time))-Date.parse(str(b.time)));
 if(!series.length||series.some(s=>!Number.isFinite(Date.parse(str(s.time)))))throw new Error('Forecast is missing');
 const w=windowFor(input),first=Date.parse(str(series[0].time)),last=Date.parse(str(series.at(-1)!.time));
 if(w.start.getTime()<first||w.end.getTime()>last)return {data:[],partial:false,outside:true};
 const selected=series.filter((s,i)=>Date.parse(str(s.time))<w.end.getTime()&&Date.parse(str(series[i+1]?.time??s.time))>w.start.getTime());
 const data:Conflict[]=[];let partial=!selected.length;
 let maxRain=0,rainHours=1,maxWind=-Infinity,minTemp=Infinity,maxTemp=-Infinity;let coarse=false;
 for(const s of selected){const d=obj(s.data),instant=obj(obj(d.instant).details);const temp=num(instant.air_temperature),wind=num(instant.wind_speed);
  if(temp===undefined||wind===undefined)partial=true;else {minTemp=Math.min(minTemp,temp);maxTemp=Math.max(maxTemp,temp);maxWind=Math.max(maxWind,wind);}
  const next=series[series.indexOf(s)+1];if(next&&Date.parse(str(next.time))-Date.parse(str(s.time))>3600000)coarse=true;
  const hours=d.next_1_hours?1:d.next_6_hours?6:d.next_12_hours?12:0;
  const rain=hours?num(obj(obj(d[`next_${hours}_hours`]).details).precipitation_amount):undefined;
  if(rain===undefined)partial=true;else if(rain/hours>maxRain){maxRain=rain/hours;rainHours=hours;}
 }
 const issues:Array<[string,string,string,boolean]>=[];
 if(maxRain>=.5)issues.push(['rain','Rain forecast',`${(maxRain*rainHours).toFixed(1)} mm during a ${rainHours}-hour forecast period overlapping the event.`,maxRain>=2]);
 if(maxWind>=10)issues.push(['wind','Wind forecast',`Up to ${maxWind.toFixed(0)} m/s at sampled forecast times.`,maxWind>=15]);
 if(minTemp<=4)issues.push(['cold','Cold forecast',`As low as ${minTemp.toFixed(0)}°C at sampled forecast times.`,minTemp<=0]);
 if(maxTemp>=30)issues.push(['heat','Heat forecast',`Up to ${maxTemp.toFixed(0)}°C at sampled forecast times.`,maxTemp>=35]);
 for(const [id,title,description,high] of issues)data.push(finding(id,'weather',title,'https://www.met.no/',{type:'weather',policyKey:`weather:${id}`,source:'MET Norway',description,impact:high?'high':'medium',preference:defaultPreference('weather',input),startsAt:w.start.toISOString(),endsAt:w.end.toISOString(),evidence:'observed',timing:'forecast',relevance:'overlap',resolutionEligible:!partial&&!coarse,caveat:coarse?'Forecast samples are several hours apart; small time changes cannot be verified.':'Forecasts may change. Thresholds are planning prompts, not safety limits.'}));
 return {data,partial:partial||coarse,outside:false};
}
export async function checkWeather(input:EventInput):Promise<CheckResult>{
 if(!input.isOutdoor)return skip('weather','Indoor event');
 let outside=false; const result=await run('weather',input,async()=>{const u=`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${input.venue.lat!.toFixed(4)}&lon=${input.venue.lng!.toFixed(4)}`;
 const response=await getJson(u,900000,{'User-Agent':process.env.MET_USER_AGENT?.trim()||identity()});const parsed=parseWeather(response.data,input);
 if(parsed.outside){outside=true;return {data:[],partial:true};}return {...parsed,fetchedAt:response.fetchedAt,message:parsed.partial?'Some variables or fine-grained forecast times are unavailable.':undefined};});
 // run() deliberately hides provider errors; use the published window before interpreting emptiness below.
 if(outside) {return outcome('weather','MET Norway','https://www.met.no/','out_of_range',[],'Forecast not yet available for the whole event.');}
 return result;
}
