import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { FeedConfig } from './feed-config';
import { getBytes,getJson,getText } from '../http';
const checked=new Map<string,number>();
export function publicAddress(ip:string):boolean{
  if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224||a===198&&(b===18||b===19)||a===192&&b===0);}
  if(isIP(ip)===6){const a=ip.toLowerCase();return !(/^(::|fe[89ab]|f[cd]|ff)/.test(a)||a.startsWith('2001:db8:'));}
  return false;
}
/** Configuration is operator-controlled. No API route accepts feed URLs from visitors. */
export async function assertFeedUrl(raw:string,c:FeedConfig):Promise<URL>{
  const u=new URL(raw),hosts=[new URL(c.endpoint).hostname,...c.allowedHosts??[]];
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||!hosts.includes(u.hostname)||isIP(u.hostname)||u.hostname==='localhost'||!u.hostname.includes('.'))throw new Error('Unapproved feed URL');
  if((checked.get(u.hostname)??0)<Date.now()){
    let timer:ReturnType<typeof setTimeout>|undefined;
    const records=await Promise.race([lookup(u.hostname,{all:true}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('Feed DNS lookup timed out')),3000);})]).finally(()=>{if(timer)clearTimeout(timer);});if(!records.length||records.some(r=>!publicAddress(r.address)))throw new Error('Feed must resolve to public addresses');
    if(checked.size>100)checked.clear();checked.set(u.hostname,Date.now()+300000);
  }
  return u;
}
export async function feedRequest(c:FeedConfig,format:'json'|'text'|'bytes',target=c.endpoint,init:RequestInit={}):Promise<{data:unknown;fetchedAt:string}>{
  const u=await assertFeedUrl(target,c);const headers:Record<string,string>={};
  if(c.auth){const secret=process.env[c.auth.env];if(!secret)throw new Error('Feed credentials are missing');
    // Never send a parent feed's key to another host discovered inside its payload.
    if(u.hostname!==new URL(c.endpoint).hostname)throw new Error('Cross-host credential forwarding refused');
    if(c.auth.header)headers[c.auth.header]=(c.auth.prefix??'')+secret;
    if(c.auth.query)u.searchParams.set(c.auth.query,secret);
  }
  const ttl=Math.max(30,Math.min(86400,c.ttlSeconds??300))*1000;
  if(format==='json')return getJson(u.toString(),ttl,headers,init);
  if(format==='bytes')return getBytes(u.toString(),ttl,headers);
  return getText(u.toString(),ttl,headers);
}
