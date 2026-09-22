const {discoverMobility,checkMobilityAccount,discoverArcgis,discoverCkan,discoverWzdx}=require('@/lib/connectors/discovery');
const {safeMessage}=require('@/lib/http');
async function main(){const [mode,...args]=process.argv.slice(2);let result;
 switch(mode){case 'mobility':result=await discoverMobility(args[0]||'PT');break;case 'mobility-auth':result=await checkMobilityAccount();break;case 'arcgis':result=await discoverArcgis(args.join(' '));break;case 'ckan':result=await discoverCkan(args[0],args.slice(1).join(' '));break;case 'wzdx':result=await discoverWzdx();break;default:console.log('Usage:\n  npm run discover -- mobility PT\n  npm run discover -- mobility-auth\n  npm run discover -- arcgis "Lisbon road closures"\n  npm run discover -- ckan https://your-official-portal.org "road works"\n  npm run discover -- wzdx');return;}
 console.log(JSON.stringify(result,null,2));}
main().catch(e=>{console.error(`Discovery could not complete: ${safeMessage(e)}. Check the command, account access and network. See docs/FEEDS.md.`);process.exitCode=1;});
