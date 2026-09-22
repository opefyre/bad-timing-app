# Regional feed setup

## Why a registry is necessary

A GTFS, CAP, DATEX, ArcGIS, Socrata or CKAN connector is not a global data subscription. You must identify the actual publisher, access method, fields, licence and geographic/time scope. A city catalogue may contain archived data or non-DataStore CSV files. A transport agency may publish vehicle positions but no service alerts.

`src/config/feeds.json` holds approved records and ships empty. `docs/feeds.examples.json` holds **disabled, illustrative records**. They are not live integrations and must not all be copied/enabled without replacing their example values. `docs/presets/meteoalarm-portugal.json` is a separate optional endpoint preset; fetch/parse and check its licence on your network before enabling it. Public availability was documented, but its full live Atom→CAP chain was not verified in the build sandbox.

## Find a source

```bash
npm run discover -- mobility PT
npm run discover -- mobility GB
npm run discover -- mobility-auth
npm run discover -- arcgis "Lisbon road closures"
npm run discover -- ckan https://your-official-portal.org "road works"
npm run discover -- wzdx
```

Mobility discovery uses the official public CSV and joins service-alert feeds to their static feed references for country matching. It never claims a discovered feed has been checked or automatically approves its URL. `mobility-auth` separately tests the documented refresh-token exchange and metadata endpoint; no token is printed. The other commands return metadata to review, not an automatic trust decision.

For European road feeds use the [European Commission National Access Points directory](https://transport.ec.europa.eu/transport-themes/smart-mobility/road/its-directive-and-action-plan/national-access-points_en). The app does **not** silently invent an endpoint for every EU country.

## Required common fields

| Field | Meaning |
|---|---|
| `id` | Stable lower-case identifier. It appears in coverage and preference keys. |
| `kind` | `cap`, `meteoalarm`, `gtfs`, `datex`, `wzdx`, `arcgis`, `socrata`, `ckan`, `open311`, `rss`, `atom`, `ics`. |
| `enabled` | Must be `true` to run; templates are `false`. |
| `name`, `publicUrl` | Actual publisher name and a safe, public information page. |
| `licenceUrl`, `attribution` | Dataset-specific reuse terms and required source-credit text. |
| `endpoint` | Final HTTPS URL. Redirects are rejected; never put literal secrets here. |
| `countries` | ISO two-letter country codes. Not a claim of countrywide coverage. |
| `bounds` | Optional catchment `[west, south, east, north]`; required with GTFS unless an `areaGeometry` is supplied. |
| `timezone` | IANA timezone required when the publisher supplies local/floating times. |
| `auth` | `{ "env": "GTFS_API_KEY", "header": "x-api-key" }` or `query`, not both. Optional `prefix`, e.g. `Bearer `. |

Other optional fields include `ttlSeconds` (30–86400), `maxAgeHours`, `staticLocation`, `areaGeometry`, `type`, `limit` (clamped 10–500), `pageLimit` (1–5). Use a static location only when **every item really belongs to that venue**. Use an area polygon only when the notice explicitly applies across that area. Neither is a shortcut for pretending a whole city's news occurred at the user's pin.

### CAP / MeteoAlarm

Fetch an actual public CAP XML document or an Atom wrapper containing CAP links. `followCapLinks: true` follows at most 12 URLs; every target host must appear in `allowedHosts` or match the configured host. Each request is HTTPS/public-DNS checked. Parent credentials are never forwarded to another host. A separately authenticated CAP host needs its own configuration/adapter; broadening an allowlist does not bypass credential isolation.

Only `Actual`, `Public` alerts are included. Test/exercise messages and referenced cancellations are suppressed. Polygon/circle matching is supported. Publishers that use only geocodes need `capGeocodes` mappings to GeoJSON areas. Unknown areas are limited coverage, not guessed. Official alerts retain severity/certainty and are **not** declared resolved by a time suggestion. The MeteoAlarm adapter supports CAP/Atom, not an assumed universal EDR endpoint; registration-based EDR access alone does not supply the configured CAP URL.

### GTFS-Realtime

Use a **full-dataset service-alert protobuf**, not a vehicle-position feed. `gtfs.stopIds`, `routeIds` and `agencyIds` must use the agency's own IDs, with a reviewed geographic catchment. A selector containing multiple fields is matched conjunctively. Agency-wide alerts need `wholeAgencyArea:true` plus a real `areaGeometry`. Static GTFS discovery does not itself connect alerts.

Feed headers must be fresh (default one hour, configurable) and not future-dated. Differential feeds require persistent state and are rejected. Trip-only, direction-specific or route-type-only selectors are flagged as incomplete rather than guessed. Open-ended validity has no fabricated end time. This intentionally does not promise full network or attendee-route coverage.

### DATEX II

Supports SituationPublication records with WGS84 point/coordinate data and simple overall start/end validity. Suspended records are ignored. Linear references, ALERT-C/OpenLR-only geometry and complex recurring validity require a jurisdiction-specific resolver and are flagged as incomplete. This is not a full DATEX II schema implementation.

### WZDx

Supports WZDx 4.x GeoJSON work-zone features, the road-event `core_details` and `start_date` / `end_date`. Uses the actual geometries, tracks feed update freshness, and does not interpret a planned completion date as verified completion. Moving work zones cannot be resolved by this optimiser. Some feeds are large: use an official regional endpoint instead of removing the payload cap blindly.

### ArcGIS / Socrata / CKAN

`fields` maps real schema names: required `id`, `title`; optional `description`, `start`, `end`, `updated`, `status`, `lat`, `lon`, `geometry`, `url`. Dotted paths are accepted. Record geometry or mapped coordinates are essential. The report discards rows outside the radius; unidentified geometry/time makes coverage partial.

- **ArcGIS:** use a specific feature layer URL ending in its layer number, not a portal page. The adapter queries `/query`, requests WGS84 GeoJSON and a spatial envelope, then filters exact radius/time. Pagination and exceeded-transfer limits are tracked. Verify your service supports GeoJSON and pagination. Set `orderBy` to a stable unique field.
- **Socrata:** set `endpoint` to the data portal origin, `datasetId`, and `auth` with an `X-App-Token` header reference. Uses the current SODA3 **POST** query endpoint, JSON body, one-based pages and application token. `where` is an operator-written SoQL expression. Set a stable `orderBy`.
- **CKAN:** set the portal origin and actual DataStore `resourceId`. Uses `datastore_search`; the API's `success` flag is checked even when HTTP is 200. `where` is **not** a CKAN SQL expression; the current adapter performs time/radius filtering locally on bounded returned pages. Configure a narrow, current resource and stable `orderBy`. A non-DataStore resource needs its appropriate RSS/ICS/GeoJSON adapter instead.

For ArcGIS/Socrata `where`, placeholders are `{{start}}` / `{{end}}` (UTC ISO), `{{date}}`, `{{lat}}`, `{{lon}}`, `{{radiusMeters}}`. Write a predicate in the dataset's actual query dialect; SQL date syntax is not universal. Placeholders come from validated event fields, never an arbitrary visitor-supplied query.

`timeMode:"scheduled"` requires true event start/end fields. `timeMode:"published"` treats timestamps as report publication only. `timeMode:"current"` is current context. Do not map publication/last-edited fields to incident start/end. `dateOnlyEndInclusive:true` applies only where the publisher explicitly defines a date-only end as inclusive. `cancelledValues` must match the source's actual cancellation vocabulary.

### Open311

`endpoint` is the GeoReport base, before `/requests.json`. Optional `jurisdictionId` and `serviceCodes` narrow the query. The standard does not provide a universal radius query, so recent open requests are filtered locally. Only service type, approximate distance and timestamps are shown: no reporter names, photographs, phone numbers or free-text descriptions. Community reports are unverified and never prove a venue is unsafe or clear.

### Official RSS / Atom

Use a reviewed official publisher. GeoRSS coordinates, explicit static venue or a legitimate whole-area geometry are required; city-name mentions are not sufficient. Publication/update date is not the event occurrence date. Notices remain in “Check locally”. Ordinary news belongs in the opt-in GDELT flow, not an “official” civic feed configuration.

### ICS public calendars

Only **public** calendars: no private calendar tokens, private feeds or attendee details. Supports single VEVENTs, date-only all-day events, UTC/IANA/floating times (configured timezone required), durations, `EXDATE`, `RDATE`, daily/weekly recurrence with interval/count/until and weekly day selection. Single occurrence overrides/cancellations are handled conservatively and make coverage partial because bounded expansion cannot prove completeness across every moved occurrence.

Monthly/yearly rules, unknown recurrence components, custom timezone definitions and complex override semantics are not fully implemented. Unsupported items yield partial coverage; they are not silently turned into “nothing happening”. `DTEND` is exclusive. No event end is invented when none is supplied. Validate representative real publisher records with `npm run smoke` before enabling a calendar publicly.

## Validate and enable

1. Read publisher access/terms, inspect real payloads and determine the actual coverage.
2. Add an approved record with `enabled:true`; add its secret to your local/hosting environment.
3. Run `npm run doctor`, `npm run check`, and one smoke event **inside** that feed's area and date range. Check both a known positive case and a date/location that should not match.
4. Verify attribution on `/sources` and record current quota/retention requirements.
5. Rebuild/redeploy after changing the bundled feed registry.

There is no automatic web scraping, social-media account scraping, partner-only Waze access, or speculative prediction of protests, official visits or accidents.
