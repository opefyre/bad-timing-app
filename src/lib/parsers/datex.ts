import { Conflict,EventInput } from '@/types';
import { FeedConfig } from '../connectors/feed-config';
import { parseXml,descendants,value,deepValue,content } from './xml';
import { geometryDistance } from './geometry';
import { finding,hash,iso,radius,during,currentEvent,text,num } from '../connectors/util';
/** WGS84 SituationPublication subset. No guessed conversion of ALERT-C/OpenLR locations. */
export function parseDatex(raw:string,input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean}{
  const root=parseXml(raw);const records=descendants(root,'situationRecord');const data:Conflict[]=[];let partial=false;
  if(!records.length&&!descendants(root,'payloadPublication').some(n=>Object.values(n.attrs).some(v=>v.includes('SituationPublication'))))throw new Error('No SituationPublication found');
  for(const record of records){
    if(['suspended'].includes(deepValue(record,'validityStatus')))continue;
    if(descendants(record,'validPeriod').length||descendants(record,'exceptionPeriod').length){partial=true;continue;}
    const coordinateNodes=[...descendants(record,'pointCoordinates'),...descendants(record,'locationForDisplay')];
    const points=coordinateNodes.map(n=>[num(deepValue(n,'longitude')||value(n,'longitude')),num(deepValue(n,'latitude')||value(n,'latitude'))]).filter((p):p is [number,number]=>p.every(n=>n!==undefined));
    if(!points.length){partial=true;continue;}
    const km=geometryDistance(input,{type:points.length===1?'Point':'MultiPoint',coordinates:points.length===1?points[0]:points});if(km>radius(input))continue;
    const startsAt=iso(deepValue(record,'overallStartTime')),endsAt=iso(deepValue(record,'overallEndTime'));
    if(startsAt&&endsAt&&!during(input,startsAt,endsAt))continue;
    if((!startsAt||!endsAt)&&!currentEvent(input,Date.now(),24)){partial=true;continue;}
    const type=Object.entries(record.attrs).find(([k])=>k.endsWith(':type'))?.[1].split(':').pop()||'Road notice';
    const title=type.replace(/([a-z])([A-Z])/g,'$1 $2');const descriptions=descendants(record,'comment').map(n=>deepValue(n,'value')||content(n));
    const planned=!!startsAt&&new Date(startsAt).getTime()>Date.now();const probability=deepValue(record,'probabilityOfOccurrence');
    data.push(finding(record.attrs.id||hash(content(record)),c.id,c.name,c.publicUrl,{type:'road',title,description:text(descriptions.join(' · '))||'Published road situation.',startsAt,endsAt,distanceKm:km,preference:'avoid',impact:'medium',evidence:'official',timing:planned?'scheduled':'live',relevance:startsAt&&endsAt?'overlap':'context',resolutionEligible:planned&&!!endsAt&&(!probability||probability==='certain'),certainty:probability||undefined,caveat:'Location is based on published WGS84 points; complex linear references and recurring validity windows are not inferred.'}));
  }return {data,partial};
}
