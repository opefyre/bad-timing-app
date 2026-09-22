# Release verification · BAD TIMING v3

Verified in the authoring environment on **22 September 2026**. This document distinguishes executable checks from live provider access and deployment certification.

## Results

| Check | Result | What it establishes |
|---|---|---|
| `npm run check` | **Passed** | ESLint, TypeScript, and all 108 offline tests |
| ESLint | **0 errors, 0 warnings** | Source lint rules pass |
| TypeScript | **0 errors** | Application and route type checks pass |
| Offline tests | **108 passed, 0 failed, 0 skipped** | Deterministic request/response contracts, parsers, date handling, decisions and failure cases |
| Rendered UI review | **22 checks passed; no page JavaScript errors** | Desktop/mobile layout and component interactions in an isolated browser harness with mocked responses |
| Configuration doctor | **Ran successfully** | With no supplied credentials, correctly reports missing geocoder, application identity, public origin and operator/privacy configuration |
| `next build` | **Blocked by environment before application compilation** | Linux SWC dependency absent; npm registry DNS unavailable |
| Live authenticated provider requests | **Not verified** | No user API keys were supplied and the container could not reach providers |
| Every regional publisher/feed | **Not verified** | No operator-approved regional feeds are enabled by default |
| Production deployment / legal compliance | **Not certified** | Requires target-platform build, live tests, actual hosting settings and operator review |

## Offline test coverage

`tests/core.test.cjs` — **29 tests**. Venue-local time and DST, interval boundaries, input validation, XML entity rejection, CSV, geometry, CAP update/cancellation, DATEX validity, bounded calendar recurrence/exceptions, GTFS freshness/differential rejection, municipal timestamps, feed URL restrictions, caching and HTTP failure handling.

`tests/connectors.test.cjs` — **37 tests**. TomTom, Transitland, Ticketmaster, football-data, TVmaze, MET, Sunrise-Sunset, UK holidays, TfL, OpenHolidays, GDELT, IPMA, NWS, GDACS, EONET, FIRMS, USGS, Open-Meteo, SeatGeek, Radar and geocoding contracts. Includes authentication headers, date encodings, coordinate/order conventions, forecast limits, commercial gates, missing credentials and empty unpublished calendars. Fixtures exercise selected documented schemas; they do not certify every optional upstream field.

`tests/decision.test.cjs` — **24 tests**. Rejection of degraded or missing coverage, non-resolvable live/context items, preserved preferences, stable condition keys, new high-impact overlaps, trade-offs, plan-around changes, candidate boundaries, actual analyser invocation, deduplication and failed-source handling.

`tests/regional.test.cjs` — **14 tests**. ArcGIS geometry/query use, SODA3 POST/pagination/token, CKAN success/error handling, Open311 privacy filtering, regional credential/configuration rules, unlocated RSS, publication-versus-occurrence times, Mobility Database discovery/auth contract, ArcGIS discovery and API request guards.

`tests/ui.test.cjs` — **4 server-rendered component tests**. Current-only sources cannot certify schedule checks, source failures cannot produce a clear-date headline, empty successful queries retain limitations, and credentials are not serialized into the Sources page.

Run all tests without external API calls:

```bash
npm ci
npm run check
```

## Browser review scope

Actual React components were rendered at **1440px desktop and 390px mobile** widths for the planning form, report, Sources, Privacy and Terms. All ten page/viewport combinations fit without horizontal document overflow. An isolated component bundle additionally exercised:

- Location search selection, Leaflet marker and zoom/drag controls.
- Custom start and duration pickers; matching 52px setting/input heights.
- Radius, news and internet options submitted to analysis.
- Organiser preferences, alternative request payload and coverage disclosure.
- Mobile report and calendar popover layout.

The harness used the app's source components and CSS, synthetic API responses and a simple anchor in place of Next Link. It was **not** a Next production server or hydration test. External map-tile delivery and device location permission were not verified. No synthetic findings or browser-test transport are included in the app's live analysis path.

## Production build limitation

The input archive's dependencies were installed on macOS. For offline checks, that installation provided the JavaScript/typechecking packages but not the Linux native Next compiler. The actual build attempt reported:

```text
Next.js 16.3.5 (Turbopack)
Downloading swc package @next/swc-linux-x64-gnu...
TypeError: fetch failed
getaddrinfo EAI_AGAIN registry.npmjs.org
```

The lockfile includes the Linux optional dependency, but it was not available locally and the registry could not be reached. Therefore **this release is not claimed to have passed a native production build**. A fresh install on the target OS, followed by `npm run check && npm run build`, is required. The archive excludes the temporary macOS `node_modules` used for offline checks.

## Live verification after credentials are configured

```bash
cp .env.example .env.local
# Fill required Geoapify and app-identity values plus the optional accounts you use.
npm run doctor
npm run smoke
npm run smoke -- event.json --strict
```

`smoke` first checks Geoapify, then analyses one event. It consumes actual provider quota. It does not search alternatives. It prints source states/counts, not credentials, raw event bodies or upstream error payloads. `--strict` fails when a requested live source is unavailable; it does not make optional/unconfigured feeds required.

Exercise separate public test locations and times for London/TfL, US/NWS, Portuguese/IPMA coverage, every configured regional feed, selected football/TV interests, news, internet, forecasts and future schedules. In the UI, check both alternative modes and verify source coverage remains comparable. Repeat after changing provider plans or feed mappings.

## Explicit connector boundaries

These are implementation limits, not hidden passes:

- Regional feeds need approved endpoints, licences, time semantics and geographic mapping. The shipped registry is empty.
- Transitland is marked limited because stop/route/agency queries do not establish complete trip-specific coverage or feed freshness.
- Direct GTFS-RT accepts fresh full datasets; differential feeds are not silently merged without persistence.
- DATEX II supports the described WGS84 situation subset, not every linear-reference or recurrence profile.
- ICS supports bounded single/daily/weekly patterns; unsupported recurrence/timezone cases remain limited.
- GDELT is optional headline discovery, not a verified geolocated incident register.
- Satellite, recent disaster, earthquake and internet observations are current context, not forecasts or safety clearance.
- Open-Meteo integration currently covers hourly AQI/particulate checks, not every available pollen/UV/dust variable.
- MeteoAlarm is implemented through configurable CAP/Atom feeds, not a blanket promise of EDR-account access.
- GDACS uses its public RSS rather than an untested API registration flow.
- Waze partner-only access is not included.
- Minimum-change search is bounded; the result is best among checked candidates, not an exhaustive optimisation proof.

See [FEEDS.md](FEEDS.md), [CONNECTORS.md](CONNECTORS.md) and [SECURITY.md](SECURITY.md) for setup and operational boundaries. Documentation alignment and passing fixtures do not guarantee current account entitlement, live API uptime, complete local data, or public-launch readiness.
