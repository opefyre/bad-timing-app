import { CheckResult, Conflict, EventInput } from '@/types';
import { provider } from './catalog';
import { failure, missing, outcome } from './util';
export const commercial = () => process.env.APP_USAGE === 'commercial';
export function skip(id: string, message: string, state: CheckResult['state'] = 'not_applicable'): CheckResult {
  const p = provider(id); return outcome(id,p.name,p.docs,state,[],message);
}
export async function run(id: string, input: EventInput, work: () => Promise<{data:Conflict[];partial?:boolean;message?:string;scope?:CheckResult['scope'];fetchedAt?:string;limitations?:string[]}>, options: {key?:string;when?:boolean;reason?:string;live?:boolean} = {}): Promise<CheckResult> {
  const p=provider(id);
  if (options.when === false) return skip(id,options.reason ?? 'Not needed');
  if (options.key && !process.env[options.key]) return missing(id,p.name,p.docs);
  if (!input.venue.timezone || !Number.isFinite(input.venue.lat) || !Number.isFinite(input.venue.lng)) return skip(id,'Choose a location first','unavailable');
  try { const r=await work(); return outcome(id,p.name,p.docs,r.partial?'partial':'checked',r.data,r.message,{scope:r.scope??(options.live?'current':'event'),fetchedAt:r.fetchedAt,limitations:r.limitations}); }
  catch(error) { return failure(id,p.name,p.docs,error); }
}
export function identity(): string {
  const contact = process.env.CONTACT_EMAIL || process.env.SITE_URL;
  if (!contact) throw new Error('Application contact is not configured');
  return `BadTiming/3.0 (${contact})`;
}
