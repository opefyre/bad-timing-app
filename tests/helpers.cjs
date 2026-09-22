const event = (extra = {}) => ({ venue: { address: 'Test venue', lat: 38.72, lng: -9.14, countryCode: 'PT', countryName: 'Portugal', timezone: 'Europe/Lisbon', city: 'Lisbon', state: 'Lisboa' }, dateTime: '2026-10-10T18:00', durationMinutes: 90, eventKind: 'meetup', isOutdoor: true, radiusKm: 3, ...extra });
function reply(data, status = 200, headers = {}) { return new Response(typeof data === 'string' || data instanceof Uint8Array ? data : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } }); }
async function mocked(fn, callback) {
  const { clearHttpCache } = require('@/lib/http'); clearHttpCache(); globalThis.__badTimingCache?.clear();
  const old = global.fetch; const calls = [];
  global.fetch = async (url, options = {}) => { calls.push({ url: new URL(url), options }); return fn(new URL(url), options); };
  try { return await callback(calls); } finally { global.fetch = old; clearHttpCache(); globalThis.__badTimingCache?.clear(); }
}
function fixtureFeed(kind, extra = {}) { return { id: `test-${kind}`, kind, enabled: true, name: `Test ${kind}`, endpoint: 'https://feed.example.org/data', publicUrl: 'https://feed.example.org/', licenceUrl: 'https://feed.example.org/licence', attribution: 'Test publisher', countries: ['PT'], timezone: 'Europe/Lisbon', staticLocation: { lat: 38.72, lng: -9.14 }, ...extra }; }
function varint(n) { const a = []; do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 128; a.push(b); } while (n); return Buffer.from(a); }
function pb(...fields) { return Buffer.concat(fields); }
function field(id, v) { const bytes = typeof v === 'string' ? Buffer.from(v) : v; return typeof v === 'number' ? pb(varint(id * 8), varint(v)) : pb(varint(id * 8 + 2), varint(bytes.length), bytes); }
module.exports = { event, reply, mocked, fixtureFeed, pb, field };

async function withEnv(vars,fn){const before={};for(const [key,value]of Object.entries(vars)){before[key]=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;}try{return await fn();}finally{for(const[key,value]of Object.entries(before)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}}
module.exports.withEnv=withEnv;
