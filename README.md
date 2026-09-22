# BAD TIMING

**Check the date before you send the invitation.**

BAD TIMING checks public outside-world signals around an event — nearby Ticketmaster events, selected football fixtures, selected TV programmes, UK bank holidays, MET Norway weather, daylight, and London TfL disruptions — then lets the organiser decide how each finding should be treated:

- **Avoid it** — a hard conflict the recommendation engine should try to remove.
- **Doesn't matter** — ignore it when suggesting alternatives.
- **Plan around it** — keep it visible as an opportunity/soft objective while fixing hard conflicts.

The alternative engine re-runs the checks against real candidate times and nearby days; it does not assume a shift solved a conflict.

## Local setup

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env.local`
3. Add the API keys you use.
4. Run `npm run dev`
5. Open `http://localhost:3000`

## Environment variables

```bash
GEOAPIFY_API_KEY=
TICKETMASTER_API_KEY=
FOOTBALL_DATA_API_KEY=

# Optional. TfL may require registered credentials for production traffic.
TFL_APP_ID=
TFL_APP_KEY=

# MET asks clients to identify themselves with contact information.
MET_USER_AGENT="BadTiming/1.0 contact: your-email@example.com"
```

TVmaze, GOV.UK Bank Holidays and Sunrise-Sunset do not require API keys.

## Important product notes

- Event input time is treated as **venue-local time**, using Geoapify's IANA timezone metadata.
- TfL is only queried for venues inside Greater London.
- GOV.UK holidays are only queried for Great Britain / Northern Ireland and the correct division is selected from the geocoded region.
- Weather clearly reports when the event is outside the currently returned forecast range.
- Source failures are shown as unavailable/out-of-range; they are never silently presented as “nothing found”.
- Sunrise-Sunset and TVmaze attribution is displayed in the report UI.
- Ticketmaster terms should be reviewed before monetising a product that uses their data.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
```
