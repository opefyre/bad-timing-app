# BAD TIMING · v3

**Check the date before you send the invitation.**

Extends the working v2 pixel app: the map, draggable pin, geolocation button, custom date/time and duration pickers, logo, and organiser intent controls are preserved. The main change is a substantially broader, evidence-aware public-data engine.

## Start

Use **Node.js 22 LTS** and a fresh install on your own operating system. Do not copy `node_modules` from a Mac to Linux.

```bash
npm ci
cp .env.example .env.local
# Set GEOAPIFY_API_KEY and a genuine CONTACT_EMAIL.
# Set SITE_URL to your deployed HTTPS origin before publishing.
npm run doctor
npm run dev
```

Open `http://localhost:3000`. Add whichever optional provider keys you obtain. A missing key is **Not connected**, never “checked with no problems”. The app has no test/demo findings in its live request path.

```bash
npm run check                   # ESLint, TypeScript and offline fixture/contract tests
npm run smoke                   # One live check near a public Lisbon point, one hour ahead
npm run smoke -- event.json      # Your own EventInput JSON, no alternative search
npm run doctor -- --strict      # Fails for incomplete deployment information
npm run build
npm start
```

The smoke command first verifies the required Geoapify connection, then consumes your other configured provider allowances and prints statuses/counts, not event bodies or keys. Select news/internet/team/programme options in `event.json` to exercise those conditional sources. Test London, a US venue, and each regional feed's actual area separately. A Lisbon test cannot validate every geographic connector.

## What is included

| Layer | Implementations |
|---|---|
| Existing sources, repaired | Geoapify; Ticketmaster; football-data.org; TVmaze; UK bank holidays; MET Norway; Sunrise-Sunset v2; TfL |
| Additional direct checks | TomTom Orbis Traffic; Transitland; OpenHolidays public/school calendars; GDELT headlines; IPMA; NWS; GDACS RSS; NASA EONET; NASA FIRMS; USGS; Open-Meteo air quality; SeatGeek; Cloudflare Radar |
| Regional feed adapters | CAP; MeteoAlarm CAP/Atom; full-dataset GTFS-Realtime service alerts; DATEX II WGS84 situations; WZDx 4.x; ArcGIS feature layers; Socrata SODA3; CKAN DataStore; Open311; official RSS/Atom; a bounded ICS recurrence subset |
| Administrator discovery | Mobility Database CSV + account verification; ArcGIS public catalogue; CKAN catalogue; WZDx registry |

**Regional feeds are not automatically connected worldwide.** `src/config/feeds.json` is intentionally empty until you approve real publishers, licences, area mappings and credentials. The adapters are executable implementations, but municipal datasets are not interchangeable and no API key supplies every city. [Feed setup](docs/FEEDS.md) includes disabled templates and an optional public MeteoAlarm Portugal preset. Waze is not included: it is a partner-access service, not an open app API.

## Report and decision logic

“At this time” shows a dated overlap. “Check locally” holds live incidents, recent headlines, incomplete schedules and regional context. Findings carry source links, evidence type, time semantics, distance where justified, and limitations. No success score, inferred crowd estimate or safety clearance.

Each finding supports **Avoid it / Doesn't matter / Plan around it**. Only bounded, sufficiently checked schedules/forecasts can be considered resolved by changing time. A missing or degraded source never counts as improvement. Current news, live accidents, observations and official active warnings remain unresolved context. Football's two-hour duration is explicitly an estimate.

Alternative checks run only when requested. Earlier candidates use 15/30/45/60/90/120/180/240-minute moves plus relevant published boundaries, within the same day. Other-day candidates keep the time and test +1/+2/+3/+7 days. The search reanalyses candidates, preserves the organiser's choices, evaluates newly introduced conflicts and soft “plan around” alignment, and returns the best among the checked set—not a mathematical global optimum. A bounded search deadline protects API usage. Refresh still matters because upstream facts change.

## Keys, quotas and permissions

See [CONNECTORS.md](docs/CONNECTORS.md) for every provider, documentation link, credential, coverage and implementation caveat. All keys remain server-side. The app still needs a small **Node-capable server/serverless deployment**; it is not a static/browser-only app. No database, queue or background worker is required.

Free plans are finite and some uses require approval or payment. `APP_USAGE=commercial` gates Ticketmaster and Radar unless you explicitly confirm permission, and requires an Open-Meteo customer key. This flag does not grant a licence. Review every source plan and each configured municipal/transit dataset. Configure hard provider spending caps and edge rate limits before a public launch.

## Deployment

Use an up-to-date Node/Next-compatible host. The API routes declare maximum durations of 120 seconds for analysis and 300 seconds for alternative searches; the host must actually support these or you must reduce the enabled sources/search budget. The default earlier search budget is 90 seconds between candidates, plus the in-flight candidate and base analysis. Hosts can impose a shorter limit regardless of the route declaration.

This ZIP does not contain a deployment, API accounts, domain, private keys or `node_modules`. Run a native build on the deployment platform. The included CI workflow does `npm ci`, checks and build. Hosting, licences, keys, regional feed scope and privacy details remain the deployer's responsibilities.

Legal routes: `/sources`, `/data` (privacy), `/terms`. Set the operator/hosting/privacy fields in `.env.local` or deployment environment. An incomplete privacy notice is visibly identified; no fictional operator or guessed log-retention policy is published. The text is a deployment-aware starting notice, **not a legal-compliance certification**.

## Engineering safeguards

Venue IANA timezones; missing DST times rejected; repeated clock-change times explicitly noted. Bounded HTTP timeout and payloads; conditional caching; concurrent-request deduplication; short failure backoff; provider 429 cooldown; guarded same-origin API routes; strict input validation; request-size and per-instance rate safeguards. Regional feed URLs are operator-controlled, HTTPS-only, public-DNS checked, allowlisted, and do not follow redirects or forward secrets across hosts. XML DTDs are rejected. Upstream HTML and executable URLs are not rendered.

These controls are not a substitute for a production firewall/global quota limit, upstream terms review or security review. Full details and known limits are in [VALIDATION.md](docs/VALIDATION.md) and [SECURITY.md](docs/SECURITY.md).

## Project map

- `src/lib/analyzer.ts` — source orchestration and honest coverage status.
- `src/lib/alternatives.ts` — actual rechecks and comparisons.
- `src/lib/connectors/` — direct providers, civic adapters, discovery and registry.
- `src/lib/parsers/` — bounded CAP/XML/CSV/GTFS/DATEX/ICS/geometry parsers.
- `src/config/feeds.json` — **your approved local feeds**, no secret values.
- `src/components/ReportView.tsx` — evidence-aware report with organiser controls.
- `tests/` — deterministic offline tests, not claimed as live API validation.
- `scripts/` — configuration, discovery and live smoke tools.

See [CHANGELOG.md](docs/CHANGELOG.md) for the v2 → v3 changes.
