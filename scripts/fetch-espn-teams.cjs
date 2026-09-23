const fs = require('node:fs');
const path = require('node:path');

const LEAGUES = [
  { slug: 'eng.1', name: 'Premier League', country: 'England' },
  { slug: 'esp.1', name: 'LaLiga', country: 'Spain' },
  { slug: 'ger.1', name: 'Bundesliga', country: 'Germany' },
  { slug: 'ita.1', name: 'Serie A', country: 'Italy' },
  { slug: 'fra.1', name: 'Ligue 1', country: 'France' },
  { slug: 'por.1', name: 'Liga Portugal', country: 'Portugal' },
  { slug: 'ned.1', name: 'Eredivisie', country: 'Netherlands' },
  { slug: 'bra.1', name: 'Brasileirão Série A', country: 'Brazil' },
  { slug: 'usa.1', name: 'Major League Soccer', country: 'United States' },
  { slug: 'mex.1', name: 'Liga MX', country: 'Mexico' },
  { slug: 'arg.1', name: 'Liga Profesional', country: 'Argentina' },
  { slug: 'bel.1', name: 'Belgian Pro League', country: 'Belgium' },
  { slug: 'sco.1', name: 'Scottish Premiership', country: 'Scotland' },
  { slug: 'tur.1', name: 'Süper Lig', country: 'Türkiye' },
  { slug: 'den.1', name: 'Superligaen', country: 'Denmark' },
];

function norm(name) {
  return String(name).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  const teams = [];
  for (const league of LEAGUES) {
    const url = `https://site.web.api.espn.com/apis/site/v2/sports/soccer/${league.slug}/teams`;
    try {
      const response = await fetch(url, { redirect: 'error', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      const rows = (json.sports?.[0]?.leagues?.[0]?.teams ?? []);
      let count = 0;
      for (const row of rows) {
        const team = row.team ?? {};
        const id = String(team.id ?? '');
        const name = team.displayName ?? team.name ?? '';
        if (!id || !name) continue;
        const canonical = String(team.slug ?? '').split('-').join(' ');
        teams.push({
          id,
          name,
          norm: norm(name),
          aliases: [norm(team.shortDisplayName ?? ''), norm(canonical)].filter(Boolean).filter((a) => a && a !== norm(name)),
          league: league.slug,
          country: league.country,
        });
        count += 1;
      }
      console.log(`${league.slug.padEnd(7)} ${league.name.padEnd(24)} ${count} teams`);
    } catch (error) {
      console.log(`${league.slug.padEnd(7)} ${league.name.padEnd(24)} SKIPPED (${error.message})`);
    }
    await sleep(250);
  }
  teams.sort((a, b) => a.league.localeCompare(b.league) || a.name.localeCompare(b.name));
  const out = { generatedAt: new Date().toISOString(), leagues: LEAGUES, teams };
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'config', 'espn-teams.json'), JSON.stringify(out, null, 1));
  console.log(`\nWrote ${teams.length} ESPN teams across ${LEAGUES.length} leagues to src/config/espn-teams.json`);
})().catch((error) => { console.error(error); process.exit(1); });