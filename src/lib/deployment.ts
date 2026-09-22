export function deploymentDetails(){
 const get=(key:string)=>process.env[key]?.trim()||'';
 return {operator:get('OPERATOR_NAME'),contact:get('CONTACT_EMAIL'),address:get('OPERATOR_ADDRESS'),site:get('SITE_URL'),host:get('HOSTING_PROVIDER'),hostPrivacy:get('HOSTING_PRIVACY_URL'),region:get('HOSTING_REGION'),logs:get('HOSTING_LOG_RETENTION'),basis:get('PRIVACY_LEGAL_BASIS'),transfers:get('PRIVACY_TRANSFER_NOTICE'),authority:get('PRIVACY_AUTHORITY_URL'),effective:get('LEGAL_EFFECTIVE_DATE')||'22 September 2026'};
}
export const legalReady=()=>{const d=deploymentDetails();return !!(d.operator&&d.contact&&d.address&&d.host&&d.hostPrivacy&&d.region&&d.logs&&d.basis&&d.transfers&&d.authority);};
export function externalUrl(raw:string):string|undefined{try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.toString():undefined;}catch{return undefined;}}
