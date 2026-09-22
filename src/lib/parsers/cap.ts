import { Conflict,EventInput } from '@/types';
import { FeedConfig } from '../connectors/feed-config';
import { XmlNode,parseXml,children,descendants,value,content } from './xml';
import { geometryDistance } from './geometry';
import { distance,finding,hash,iso,safeUrl,text,windowFor } from '../connectors/util';
function geometryMatch(area:XmlNode,input:EventInput,c:FeedConfig):{match:boolean;known:boolean}{
  let known=false,match=false;
  for(const p of children(area,'polygon')){
    const coords=content(p).trim().split(/\s+/).map(pair=>pair.split(',').map(Number)).filter(a=>a.length===2&&a.every(Number.isFinite)&&Math.abs(a[0])<=90&&Math.abs(a[1])<=180).map(([lat,lon])=>[lon,lat]);
    if(coords.length>=4){known=true;if(geometryDistance(input,{type:'Polygon',coordinates:[coords]})===0)match=true;}
  }
  for(const circle of children(area,'circle')){const [center,km]=content(circle).split(/\s+/);const [lat,lon]=center?.split(',').map(Number)??[];const d=distance(input,lat,lon);const r=Number(km);if(d!==undefined&&r>=0&&Number.isFinite(r)){known=true;if(d<=r)match=true;}}
  for(const code of children(area,'geocode')){const key=`${value(code,'valueName')}=${value(code,'value')}`;const g=c.capGeocodes?.[key];if(g){known=true;if(geometryDistance(input,g)===0)match=true;}}
  return {known,match};
}
export function parseCapDocuments(documents:string[],input:EventInput,c:FeedConfig):{data:Conflict[];partial:boolean;links:string[]}{
  const nodes:XmlNode[]=[];const links:string[]=[];let partial=false;let recognised=false;
  for(const doc of documents){const root=parseXml(doc);nodes.push(...descendants(root,'alert'));
    if(descendants(root,'alert').length||descendants(root,'feed').length||descendants(root,'rss').length)recognised=true;
    for(const entry of descendants(root,'entry')){
      let linked=false;
      for(const link of children(entry,'link')){if((link.attrs.type??'').includes('cap+xml')||link.attrs.rel==='related'&&/\.xml(?:\?|$)/.test(link.attrs.href??'')){const u=safeUrl(link.attrs.href);if(u){links.push(u);linked=true;}}}
      if(!descendants(entry,'alert').length&&!linked)partial=true;
    }
  }
  if(!recognised)throw new Error('Not a CAP or alert-feed document');
  const suppressed=new Set<string>();
  for(const node of nodes){if(value(node,'status')!=='Actual')continue;
    if(['Cancel','Update'].includes(value(node,'msgType'))){for(const ref of value(node,'references').split(/\s+/)){const id=ref.split(',')[1];if(id)suppressed.add(id);}}
  }
  const data:Conflict[]=[];const w=windowFor(input);
  for(const node of nodes){const id=value(node,'identifier');if(value(node,'status')!=='Actual'||value(node,'scope')!=='Public'||!['Alert','Update'].includes(value(node,'msgType'))||suppressed.has(id))continue;
    const infos=children(node,'info');const info=infos.find(i=>/^en/i.test(value(i,'language')))||infos[0];if(!info){partial=true;continue;}
    const areas=children(info,'area');const matches=areas.map(a=>geometryMatch(a,input,c));
    if(!matches.some(m=>m.match)){if(!matches.length||matches.some(m=>!m.known))partial=true;continue;}
    const startsAt=iso(value(info,'onset'))||iso(value(info,'effective'))||iso(value(node,'sent'));
    const endsAt=iso(value(info,'expires'));
    if(startsAt&&new Date(startsAt)>=w.end||endsAt&&new Date(endsAt)<=w.start)continue;
    const severity=value(info,'severity');
    data.push(finding(id||hash(content(info)),c.id,c.name,safeUrl(value(info,'web'))||c.publicUrl,{type:'warning',title:text(value(info,'headline')||value(info,'event')),description:text(value(info,'description')),evidence:'official',impact:['Extreme','Severe'].includes(severity)?'high':'medium',preference:'avoid',startsAt,endsAt,timing:'forecast',relevance:'overlap',resolutionEligible:false,areaLabel:areas.filter((_,i)=>matches[i]?.match).map(a=>value(a,'areaDesc')).join('; '),observedAt:iso(value(node,'sent')),publisherSeverity:severity,certainty:value(info,'certainty'),caveat:text(value(info,'instruction'),500)||'Follow official instructions; a different time is not a safety clearance.'}));
  }
  return {data,partial,links:Array.from(new Set(links))};
}
