# BAD TIMING

BAD TIMING checks public signals around a proposed event, then lets the organiser decide what matters: **Avoid it**, **Doesn't matter**, or **Plan around it**.

## Included checks

- Ticketmaster nearby events
- football-data.org fixtures for an optional team
- TVmaze airings for an optional programme
- GOV.UK bank holidays where relevant
- MET Norway weather
- Sunrise-Sunset daylight
- TfL disruption data for London
- Geoapify search, reverse geocoding and venue timezone
- OpenStreetMap interactive map tiles

Alternatives are checked again against the data sources instead of assuming a time shift solved a conflict.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add the API keys you want to use to `.env.local`.

```bash
GEOAPIFY_API_KEY=
TICKETMASTER_API_KEY=
FOOTBALL_DATA_API_KEY=
TFL_APP_KEY=

# Optional on localhost. Use a real contact/site identifier if you enable it.
MET_USER_AGENT=
```

TVmaze, GOV.UK, Sunrise-Sunset and OpenStreetMap do not need app API keys.

## Architecture

The browser handles the UI and interactive map. Small Next.js serverless routes handle the external checks. There is no database, account system or persistent application server.

The proxy layer is intentional: moving every check into the browser would publish API credentials, and MET Norway has production client-identification requirements that are awkward for direct browser requests. A normal Vercel/Cloudflare-compatible Next.js deployment is enough; there is no separate backend service to operate.

## Important notes

- Event time is interpreted in the venue's timezone.
- The map supports search, click-to-pick, draggable pin, pan/zoom and explicit browser geolocation.
- TfL is only queried for Greater London.
- UK bank holidays are only queried for applicable UK locations.
- Provider failures and dates outside data coverage are not reported as “clear”.
- Ticketmaster's terms should be reviewed before monetisation.
- The `/data` page documents providers, privacy considerations and current terms links.

## Check the project

```bash
npm run check
npm run build
```
