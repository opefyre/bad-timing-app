/* Maintained helper: regenerate src/config/football-teams.json from the
   football-data.org plan's competition team catalogs.
   Run: npm run teams
   The pace is set so even the free plan (10 requests/minute) can absorb it. */
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) { console.error('FOOTBALL_DATA_API_KEY is not set'); process.exit(1); }
  const headers = { 'X-Auth-Token': apiKey };
  const req = async (url) => {
    const response = await fetch(url, { headers });
    if (response.status === 429) { console.log(`rate limited (${url}); waiting 60s`); await new Promise(r => setTimeout(r, 60000)); return req(url); }
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    return response.json();
  };
  const list = (await req('https://api.football-data.org/v4/competitions?plan=TIER_ONE')).competitions ?? [];
  const competitions = list.filter((c) => c.code);
  const byId = new Map();
  for (const competition of competitions) {
    try {
      const result = await req(`https://api.football-data.org/v4/competitions/${encodeURIComponent(competition.code)}/teams`);
      const detail = ` ${[competition.name, competition.area?.name].filter(Boolean).join(' · ')}`;
      for (const team of result.teams ?? []) {
        if (typeof team.id === 'number' && team.name && !byId.has(team.id)) byId.set(team.id, { id: team.id, name: team.name, detail });
      }
      console.log(`ok    ${competition.code} (${(result.teams ?? []).length} teams)`);
    } catch (error) {
      console.log(`skip  ${competition.code}: ${error.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 6000));
  }
  const rows = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  const target = path.join(__dirname, '..', 'src', 'config', 'football-teams.json');
  fs.writeFileSync(target, JSON.stringify(rows, null, 2) + '\n');
  console.log(`wrote ${rows.length} unique teams to ${path.relative(process.cwd(), target)}`);
})().catch((error) => { console.error(error); process.exit(1); });