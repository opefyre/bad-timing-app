/** Bounded decoder for the public GTFS-Realtime protobuf fields used by Service Alerts.
 * Unknown fields are skipped; no generated native module is required. Differential feeds
 * need persistent state and are deliberately refused by the connector. */
export type WireValue=number|Uint8Array;
export type Message=Map<number,WireValue[]>;
export function decodeMessage(bytes:Uint8Array):Message {
  if(bytes.length>5_000_000)throw new Error('Feed exceeds size limit');
  let i=0;const m:Message=new Map();let count=0;
  const varint=()=>{let n=0,mul=1;for(let j=0;j<10;j++){if(i>=bytes.length)throw new Error('Truncated protobuf');const b=bytes[i++];n+=(b&127)*mul;if(!(b&128)){if(!Number.isSafeInteger(n))throw new Error('Unsafe protobuf integer');return n;}mul*=128;}throw new Error('Invalid varint');};
  while(i<bytes.length){if(++count>100000)throw new Error('Too many protobuf fields');const tag=varint(),field=Math.floor(tag/8),wire=tag&7;if(!field)throw new Error('Invalid field');let v:WireValue;
    if(wire===0)v=varint();else if(wire===2){const len=varint();if(len>bytes.length-i)throw new Error('Truncated message');v=bytes.slice(i,i+len);i+=len;}
    else if(wire===1||wire===5){const size=wire===1?8:4;if(i+size>bytes.length)throw new Error('Truncated field');i+=size;continue;}else throw new Error('Unsupported protobuf wire type');
    const values=m.get(field)??[];values.push(v);m.set(field,values);
  }return m;
}
const nested=(m:Message,n:number)=>(m.get(n)??[]).filter((v):v is Uint8Array=>v instanceof Uint8Array).map(decodeMessage);
const string=(m:Message,n:number)=>{const v=m.get(n)?.[0];return v instanceof Uint8Array?new TextDecoder('utf-8',{fatal:true}).decode(v):'';};
const integer=(m:Message,n:number)=>{const v=m.get(n)?.[0];return typeof v==='number'?v:undefined;};
const translated=(m:Message,n:number)=>nested(m,n).flatMap(v=>nested(v,1)).map(t=>({text:string(t,1),language:string(t,2)}));
export interface TransitAlert {
  id?:string;header_text: {text:string;language?:string}[];description_text:{text:string;language?:string}[];url:{text:string;language?:string}[];
  active_period:{start?:number|string;end?:number|string}[];
  informed_entity?:{agency_id?:string;route_id?:string;stop_id?:string;trip_id?:string;route_type?:number;direction_id?:number}[];
  effect?:number|string;severity_level?:number|string;
}
export function decodeGtfs(bytes:Uint8Array):{timestamp?:number;differential:boolean;version:string;alerts:TransitAlert[]} {
  const root=decodeMessage(bytes),header=nested(root,1)[0];if(!header)throw new Error('GTFS header missing');
  const alerts:TransitAlert[]=[];
  for(const entity of nested(root,2)){
    if(integer(entity,2)===1)continue;const a=nested(entity,5)[0];if(!a)continue;
    alerts.push({id:string(entity,1),header_text:translated(a,10),description_text:translated(a,11),url:translated(a,8),active_period:nested(a,1).map(p=>({start:integer(p,1),end:integer(p,2)})),
      informed_entity:nested(a,5).map(s=>({agency_id:string(s,1)||undefined,route_id:string(s,2)||undefined,route_type:integer(s,3),trip_id:nested(s,4)[0]?string(nested(s,4)[0],1)||undefined:undefined,stop_id:string(s,5)||undefined,direction_id:integer(s,6)})),effect:integer(a,7),severity_level:integer(a,14)});
  }
  return {timestamp:integer(header,3),differential:integer(header,2)===1,version:string(header,1),alerts};
}
