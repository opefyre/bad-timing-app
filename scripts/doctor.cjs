const {configuredFeeds}=require('@/lib/connectors/feed-config');
const {PROVIDERS}=require('@/lib/connectors/catalog');
const {legalReady,deploymentDetails,externalUrl}=require('@/lib/deployment');
let issues=0;const warn=m=>{issues++;console.log(`ATTENTION  ${m}`);};
console.log('BAD TIMING · deployment check (no network calls; no credentials printed)\n');
if(Number(process.versions.node.split('.')[0])<22)warn('Use Node.js 22 or later.');
if(!process.env.GEOAPIFY_API_KEY)warn('GEOAPIFY_API_KEY is required for address search, map matching and timezone lookup.');
if(!process.env.CONTACT_EMAIL&&!process.env.SITE_URL&&!process.env.MET_USER_AGENT)warn('Set CONTACT_EMAIL / SITE_URL or a genuine MET_USER_AGENT before weather checks.');
if(!process.env.SITE_URL||!externalUrl(process.env.SITE_URL))warn('SITE_URL must be your public HTTPS origin before deployment.');
if(!['noncommercial','commercial'].includes(process.env.APP_USAGE||'noncommercial'))warn('APP_USAGE must be noncommercial or commercial.');
for(const p of PROVIDERS.filter(p=>p.mode==='key'))console.log(`${p.env&&process.env[p.env]?'SET     ':'OPTIONAL'}  ${p.name}${p.env?` · ${p.env}`:''}`);
if(process.env.SEATGEEK_CLIENT_ID&&!process.env.SEATGEEK_CLIENT_SECRET)warn('SeatGeek requires both client ID and client secret for this connector.');
try{const feeds=configuredFeeds();console.log(`\n${feeds.filter(f=>f.enabled).length} regional feeds enabled; ${feeds.length} records validated.`);for(const f of feeds.filter(f=>f.enabled)){if(f.auth&&!process.env[f.auth.env])warn(`${f.name}: ${f.auth.env} is missing.`);if(f.endpoint.includes('.example.'))warn(`${f.name}: replace the illustrative endpoint.`);}}
catch{warn('Feed configuration is invalid. Run npm run typecheck and validate against docs/FEEDS.md.');}
if(!legalReady())warn('Privacy configuration is incomplete. Set the operator, host, retention, legal basis, transfer and authority fields in .env.example.');
const d=deploymentDetails();for(const [name,value]of [['HOSTING_PRIVACY_URL',d.hostPrivacy],['PRIVACY_AUTHORITY_URL',d.authority]])if(value&&!externalUrl(value))warn(`${name} must be HTTPS.`);
if(process.env.APP_USAGE==='commercial')console.log('\nCommercial mode: Ticketmaster / Radar require permission flags; Open-Meteo requires a paid key. Verify every underlying dataset licence.');
console.log('\nDeployment still needs real-network smoke tests, provider quota controls and a build on the target platform.');
console.log(issues?`\n${issues} item(s) need attention.`:'\nConfiguration checks passed. This is not a live-access or legal-compliance certification.');
if(issues&&process.argv.includes('--strict'))process.exitCode=1;
