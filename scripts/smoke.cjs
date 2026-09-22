const fs=require('node:fs');
const {analyzeEvent}=require('@/lib/analyzer');const {geocodeVenue}=require('@/lib/geocoding');const {validateEvent}=require('@/lib/validation');const {instantToLocal}=require('@/lib/time');const {safeMessage}=require('@/lib/http');
async function main(){const args=process.argv.slice(2);const file=args.find(x=>!x.startsWith('--'));
 const input=validateEvent(file?JSON.parse(fs.readFileSync(file,'utf8')):{venue:{address:'Public test point, Lisbon',city:'Lisbon',state:'Lisboa',subdivisionCode:'PT-11',countryCode:'PT',countryName:'Portugal',lat:38.7223,lng:-9.1393,timezone:'Europe/Lisbon'},dateTime:instantToLocal(new Date(Date.now()+3600000),'Europe/Lisbon').slice(0,16),durationMinutes:90,eventKind:'meetup',isOutdoor:true,radiusKm:3,includeNews:false,needsInternet:false});
 console.error('Running one real check. This uses your configured API allowances; no alternatives are searched.');
 // Exercise the required geocoder too: pre-filled fixture coordinates alone
 // must not certify a Geoapify credential as working.
 if(!process.env.GEOAPIFY_API_KEY)throw new Error('Configure the required Geoapify key before running the live smoke check');
 const matched=await geocodeVenue(input.venue.address,typeof input.venue.lat==='number'&&typeof input.venue.lng==='number'?{lat:input.venue.lat,lng:input.venue.lng}:undefined);
 input.venue={...matched,name:input.venue.name||matched.name};
 const report=await analyzeEvent(input);const sources=report.sources.map(s=>({id:s.id,state:s.state,scope:s.scope,items:s.itemCount??0,message:s.message||'',fetchedAt:s.fetchedAt}));
 const output={checkedAt:report.checkedAt,timezone:report.event.venue.timezone,sourceResults:sources,findings:report.conflicts.length,datedOverlaps:report.conflicts.filter(c=>c.relevance==='overlap').length};
 console.log(JSON.stringify(output,null,2));
 if(args.includes('--strict')&&sources.some(s=>s.state==='unavailable'))process.exitCode=1;
}
main().catch(e=>{console.error(`Smoke check failed: ${safeMessage(e)}. Check local event details, credentials and network.`);process.exitCode=1;});
