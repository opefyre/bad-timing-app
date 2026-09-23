# Connector reference · v3

Primary documentation reviewed for this implementation: 22 September 2026. These are implementation contracts, not a certification of current account access, quotas or service availability. Free-tier limits and data licences can change; the provider dashboard and terms are authoritative.

## Geoapify

- Mode: **key** · `GEOAPIFY_API_KEY`.
- [Documentation](https://apidocs.geoapify.com/docs/geocoding/) · [Publisher](https://www.geoapify.com/).
- Coverage: Address search, reverse geocoding and venue timezone.
- Sent: Search text or selected coordinates.
- Reuse: Geoapify terms; free-plan attribution applies.

## Ticketmaster

- Mode: **key** · `TICKETMASTER_API_KEY`.
- [Documentation](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/) · [Publisher](https://www.ticketmaster.com/).
- Coverage: Listed events only. Listing start times do not establish crowd size or event end times.
- Sent: Search area and event date range.
- Reuse: Ticketmaster API terms. Revenue-generating use requires permission; disabled in commercial mode unless explicitly approved.

## football-data.org

- Mode: **key** · `FOOTBALL_DATA_API_KEY`.
- [Documentation](https://docs.football-data.org/) · [Publisher](https://www.football-data.org/).
- Coverage: Selected team, subject to your subscription and published fixtures. Match end times are estimates.
- Sent: Team search and fixture date range.
- Reuse: Provider terms; keep credentials confidential.
- Implementation: dateTo is exclusive. Exact team name/short name/abbreviation within the connected plan. A two-hour match window is explicitly estimated. The team picker reads a shipped snapshot of this plan's team catalogs (`npm run teams` regenerates it); a runtime fan-out across competitions would exceed the free plan rate limit.

## API-Football

- Mode: **key** · `API_FOOTBALL_KEY`.
- [Documentation](https://www.api-football.com/documentation-v3) · [Publisher](https://www.api-football.com/).
- Coverage: Selected teams worldwide across most national leagues and cups, by team ID. The free plan only serves the 2022-2024 seasons and about 100 requests a day, so current-season fixture checks report unavailable until the plan is upgraded; team searches are cached for 30 days and fixture windows for 3 hours.
- Sent: Team name for search; team ID with a fixture date range.
- Reuse: Provider terms; keep credentials confidential.
- Implementation: `/teams?search=` for the merged picker; `/fixtures?team=&season=&from=&to=` per selected team, season inferred from the event window, pacing ~1 request/second. Cancelled/postponed/suspended fixtures are dropped; a two-hour match window is estimated. Teams are matched by provider-native ID (never guessed across providers).

## ESPN

- Mode: **automatic** · free public API, no key.
- [Schedule API](https://site.api.espn.com/apis/site/v2/sports/soccer/) · [Publisher](https://www.espn.com/soccer/).
- Coverage: Current-season fixtures for a shipped snapshot of 15 worldwide top leagues (Premier League, LaLiga, Bundesliga, Serie A, Ligue 1, Liga Portugal, Eredivisie, Brasileirão, MLS, Liga MX, Liga Profesional, Belgian Pro League, Scottish Premiership, Süper Lig, Superligaen). Match end times are estimates.
- Sent: Selected team ID and the event calendar date, per league.
- Reuse: Publicly visible ESPN.com schedule data; respect the site terms and cache responses.
- Implementation: `site.web.api.espn.com/.../teams` snapshotted into a shipped index (`npm run teams-espn` regenerates it); per league and calendar date a `scoreboard?dates=` request is cached for 3 hours. A two-hour match window is estimated from the scheduled kickoff.

## TVmaze

- Mode: **automatic**.
- [Documentation](https://www.tvmaze.com/api) · [Publisher](https://www.tvmaze.com/).
- Coverage: Only the programme explicitly selected.
- Sent: Programme search, selected programme ID.
- Reuse: CC BY-SA; attribution and applicable share-alike obligations.

## UK bank holidays

- Mode: **automatic**.
- [Documentation](https://www.gov.uk/bank-holidays.json) · [Publisher](https://www.gov.uk/bank-holidays).
- Coverage: England/Wales, Scotland and Northern Ireland.
- Sent: No venue; the complete public calendar is fetched.
- Reuse: Open Government Licence, where applicable.

## MET Norway

- Mode: **automatic** · `MET_USER_AGENT`.
- [Documentation](https://docs.api.met.no/doc/locationforecast/HowTO.html) · [Publisher](https://www.met.no/).
- Coverage: Published forecast horizon only.
- Sent: Coordinates rounded to four decimal places; application identity.
- Reuse: CC BY 4.0. Identification and caching required.
- Implementation: Four-decimal coordinates, genuine identifying User-Agent, full available event window, 1/6/12-hour precipitation units. Coarse samples cannot justify minute-level fixes.

## Sunrise-Sunset

- Mode: **automatic**.
- [Documentation](https://sunrise-sunset.org/api) · [Publisher](https://sunrise-sunset.org/).
- Coverage: Sunrise and sunset at the selected place/date; not a visibility guarantee.
- Sent: Coordinates and calendar date.
- Reuse: Linked attribution; reasonable request volumes.

## Transport for London

- Mode: **key** · `TFL_APP_KEY`.
- [Documentation](https://api.tfl.gov.uk/) · [Publisher](https://tfl.gov.uk/).
- Coverage: Nearby stops and published line statuses in London.
- Sent: Coordinates, nearby stop and line IDs, dates.
- Reuse: TfL transport data terms. Contains Transport for London data.

## TomTom Traffic

- Mode: **key** · `TOMTOM_API_KEY`.
- [Documentation](https://docs.tomtom.com/traffic-api/documentation/tomtom-orbis-maps/v2/traffic-incidents/incident-details) · [Publisher](https://www.tomtom.com/).
- Coverage: Current and published future incidents returned for the search area. Not route-specific travel advice.
- Sent: A bounding box, not the venue address.
- Reuse: TomTom terms and your plan; attribution and caching restrictions apply.
- Implementation: Orbis v2 GET, TomTom-Api-Key / TomTom-Api-Version headers, Attributes header, bounding box, present/future filter. Published future incidents only—not prediction.

## Transitland

- Mode: **key** · `TRANSITLAND_API_KEY`.
- [Documentation](https://www.transit.land/documentation/concepts/alerts/) · [Publisher](https://www.transit.land/).
- Coverage: Alerts on returned nearby stops and selected serving routes/agencies. Trip-only alerts are not comprehensively covered.
- Sent: Coordinates, radius and nearby route/agency IDs.
- Reuse: Transitland terms plus each underlying agency/feed licence.
- Implementation: Stop alerts plus bounded serving route/agency queries; always limited coverage because trip-only alerts and feed freshness cannot be established fully from this query.

## Mobility Database

- Mode: **discovery** · `MOBILITY_DATABASE_REFRESH_TOKEN`.
- [Documentation](https://mobilitydata.github.io/mobility-feed-api/SwaggerUI/index.html) · [Publisher](https://mobilitydatabase.org/).
- Coverage: Finds feeds. A catalogue entry does not mean its alerts have been connected.
- Sent: Country/area filters when the administrator runs discovery.
- Reuse: Catalogue and individual source licences apply separately.
- Implementation: CSV service-alert discovery; separate documented refresh-token/metadata account test. No automatic feed enablement.

## GTFS-Realtime

- Mode: **feed**.
- [Documentation](https://gtfs.org/documentation/realtime/reference/) · [Publisher](https://gtfs.org/).
- Coverage: Configured full-dataset service-alert feeds and mapped stops/routes only.
- Sent: A configured feed request; normally no venue.
- Reuse: The transport agency/feed licence, not the GTFS specification.

## GDELT news

- Mode: **automatic**.
- [Documentation](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) · [Publisher](https://www.gdeltproject.org/).
- Coverage: Recent headlines mentioning the city/country and disruption terms. No inferred incident location or occurrence time.
- Sent: City/country names and general disruption keywords, only when enabled by the organiser.
- Reuse: GDELT access is open; original publishers retain rights to their articles. Headlines and links only.
- Implementation: DOC API ArtList, city/country keywords, recent window, headline/link only. Does not use the GEO-only near operator in DOC.

## OpenHolidays

- Mode: **automatic**.
- [Documentation](https://www.openholidaysapi.org/en/) · [Publisher](https://www.openholidaysapi.org/).
- Coverage: Published public and school calendars in supported countries/subdivisions. School groups may require local confirmation.
- Sent: Country, subdivision and calendar date range.
- Reuse: ODbL; attribution and applicable database share-alike obligations.

## MeteoAlarm

- Mode: **feed**.
- [Documentation](https://api.meteoalarm.org/edr/v1) · [Publisher](https://www.meteoalarm.org/).
- Coverage: Configured public CAP/Atom feeds. Geocodes without geometry need an area mapping.
- Sent: Country feed request; no venue to the feed publisher.
- Reuse: CC BY 4.0 and provider attribution; direct EDR API registration is separate.
- Implementation: Configured CAP / Atom connector, not a generic EDR integration. Unknown geocodes and unsupported links are limited coverage.

## CAP warnings

- Mode: **feed**.
- [Documentation](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html) · [Publisher](https://www.oasis-open.org/).
- Coverage: Public, actual alerts from approved feeds. Polygon/circle or configured geocode matching required.
- Sent: Configured feed requests, not a private calendar.
- Reuse: Each alert publisher’s licence; CAP is only a format.

## IPMA warnings

- Mode: **automatic**.
- [Documentation](https://api.ipma.pt/) · [Publisher](https://www.ipma.pt/).
- Coverage: Portuguese warning districts, using explicit district matching. Short published horizon.
- Sent: No venue; the national warnings feed is fetched.
- Reuse: IPMA attribution and reuse conditions; notify IPMA of use as requested in its API guidance.
- Implementation: Warnings plus explicit district/ISO subdivision matching. Does not infer a warning district by nearest city.

## US National Weather Service

- Mode: **automatic**.
- [Documentation](https://www.weather.gov/documentation/services-web-api) · [Publisher](https://www.weather.gov/).
- Coverage: US point-matched active warnings and their published validity; not a long-range warning forecast.
- Sent: Coordinates and application identity.
- Reuse: US government open data; identification and usage guidance apply.

## GDACS

- Mode: **automatic**.
- [Documentation](https://www.gdacs.org/xml/rss.xml) · [Publisher](https://www.gdacs.org/).
- Coverage: Official RSS disaster summaries; current regional context, not a venue safety boundary.
- Sent: No venue; public RSS is fetched.
- Reuse: GDACS and originating data-provider conditions; keep source attribution.

## NASA EONET

- Mode: **automatic**.
- [Documentation](https://eonet.gsfc.nasa.gov/docs/v3) · [Publisher](https://eonet.gsfc.nasa.gov/).
- Coverage: Recent open natural events near the venue. Observation locations are not hazard perimeters.
- Sent: Bounding box and recent date range.
- Reuse: NASA use guidance and original linked-source conditions.

## NASA FIRMS

- Mode: **key** · `FIRMS_MAP_KEY`.
- [Documentation](https://firms.modaps.eosdis.nasa.gov/api/area/) · [Publisher](https://firms.modaps.eosdis.nasa.gov/).
- Coverage: Recent satellite hotspots; not confirmed fires, evacuation orders or forecasts.
- Sent: Bounding box and recent observation dates.
- Reuse: NASA FIRMS citation and dataset conditions.

## USGS earthquakes

- Mode: **automatic**.
- [Documentation](https://earthquake.usgs.gov/fdsnws/event/1/) · [Publisher](https://earthquake.usgs.gov/).
- Coverage: Recent recorded earthquakes within a regional search radius; no predictions.
- Sent: Coordinates, radius and recent date range.
- Reuse: USGS public data and source-credit guidance.

## DATEX II / National Access Points

- Mode: **feed**.
- [Documentation](https://docs.datex2.eu/v3.3/situation/) · [Publisher](https://transport.ec.europa.eu/transport-themes/smart-mobility/road/its-directive-and-action-plan/national-access-points_en).
- Coverage: Configured WGS84 situation feeds. Linear-referenced-only locations and complex recurrence require a local adapter.
- Sent: Configured feed request.
- Reuse: Country/access-point dataset terms; DATEX II is not a universal data licence.
- Implementation: WGS84 SituationPublication subset, simple validity. No silent ALERT-C/OpenLR location approximation.

## WZDx work zones

- Mode: **feed**.
- [Documentation](https://github.com/usdot-jpo-ode/wzdx) · [Publisher](https://ops.fhwa.dot.gov/wz/wzdx/).
- Coverage: Configured GeoJSON work-zone feeds in participating US jurisdictions.
- Sent: Configured feed request.
- Reuse: Each publisher’s data licence.

## ArcGIS civic data

- Mode: **feed**.
- [Documentation](https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/) · [Publisher](https://hub.arcgis.com/).
- Coverage: Configured public layers with explicit fields, dates and geometry.
- Sent: Spatial search and date filters to the configured publisher.
- Reuse: Dataset-specific; public access alone is not permission to reuse.

## Socrata civic data

- Mode: **feed**.
- [Documentation](https://dev.socrata.com/docs/queries/) · [Publisher](https://dev.socrata.com/).
- Coverage: Configured SODA3 datasets and explicit field mapping. App token required.
- Sent: Bounded dataset queries and optional geographic/time filters.
- Reuse: Dataset-specific; platform documentation licence is not the data licence.

## CKAN civic data

- Mode: **feed**.
- [Documentation](https://docs.ckan.org/en/latest/api/) · [Publisher](https://ckan.org/).
- Coverage: Configured DataStore resources. Package search is discovery only.
- Sent: Configured resource ID and bounded row queries.
- Reuse: Dataset-specific; CKAN software licensing does not license the data.

## Open311

- Mode: **feed**.
- [Documentation](https://wiki.open311.org/GeoReport_v2/) · [Publisher](https://www.open311.org/).
- Coverage: Recent open public service requests, not verified hazards. Personal descriptions/media are not displayed.
- Sent: Request date/status filters; results are filtered locally by coordinates.
- Reuse: Municipal dataset-specific reuse and privacy conditions.

## Open-Meteo air quality

- Mode: **automatic** · `OPEN_METEO_API_KEY`.
- [Documentation](https://open-meteo.com/en/docs/air-quality-api) · [Publisher](https://open-meteo.com/).
- Coverage: Modelled hourly air quality during the published forecast window; not a local sensor or medical assessment.
- Sent: Coordinates and requested variables.
- Reuse: CC BY 4.0 data with attribution to Open-Meteo and CAMS. Free hosted API is non-commercial; commercial use needs an eligible plan.
- Implementation: European AQI / PM2.5 / PM10 hourly model. Full-window coverage is required for resolution eligibility. Pollen, UV and dust are not added in this build.

## SeatGeek

- Mode: **key** · `SEATGEEK_CLIENT_ID`.
- [Documentation](https://seatgeek.github.io/) · [Publisher](https://seatgeek.com/).
- Coverage: Events available to your approved API credentials. Unknown end times remain uncertain.
- Sent: Coordinates, range and event-date filters.
- Reuse: SeatGeek platform terms and your approved access plan. Free access is not guaranteed.
- Implementation: Client ID and secret using HTTP Basic, UTC query values without a timezone suffix. Unknown event end remains context. Account/plan access is not guaranteed by the code.

## Cloudflare Radar

- Mode: **key** · `CLOUDFLARE_RADAR_TOKEN`.
- [Documentation](https://developers.cloudflare.com/api/resources/radar/subresources/annotations/subresources/outages/methods/get/) · [Publisher](https://radar.cloudflare.com/).
- Coverage: Recent country/regional outage annotations, only when internet matters. Not venue connectivity monitoring.
- Sent: Country and recent date range.
- Reuse: Radar data is CC BY-NC 4.0 unless separately licensed; commercial mode requires explicit permission.
- Implementation: Bearer token, country query, documented outage annotations response. Imminent internet-dependent events only.

## Official RSS / Atom / ICS

- Mode: **feed**.
- [Documentation](https://www.rfc-editor.org/rfc/rfc5545) · [Publisher](https://www.rfc-editor.org/).
- Coverage: Configured public notices and calendars. News publication date is not an event time. Supported calendar recurrence is bounded.
- Sent: Configured feed request.
- Reuse: Publisher-specific; only authorised public feeds, never private calendars.
- Implementation: Official RSS/Atom publications remain context. ICS supports a documented daily/weekly subset; unsupported recurrences are partial.

## Key setup notes

Geoapify is needed for normal address/pin metadata lookup. Existing v2 keys use the same names. TomTom requires an account with access to Orbis Traffic Incident Details; a generic key with another product enabled may fail. Transitland uses an API key with its REST service available. FIRMS uses a MAP_KEY. Radar needs a Cloudflare API token with the documented Radar-read access. SeatGeek access and free-plan approval must be confirmed with the provider; supply both client credentials. MET and NWS require a real application identity rather than a fabricated example email.

Regional `auth.env` values are per-feed secret references. A Socrata token is an application token, not a dataset-specific field mapping. MeteoAlarm CAP/Atom access does not assume EDR-token compatibility. Key presence is not a successful live check.

## Not included as open connectors

Waze for Cities partner data, private calendars, social-network scraping, paid-only news archives, arbitrary website scraping, crowd-size predictions and route-specific travel guarantees. Major official visits or demonstrations appear only when the connected public feeds or opted-in news actually report them; the app does not predict or label political activity.

### Holiday publication coverage
OpenHolidays queries each calendar year touched by the event, caches those responses, and filters overlaps locally. An empty public/school calendar year is marked limited coverage rather than confirmed holiday-free. Regional and school-group applicability can remain unconfirmed. The standard endpoint and yearly date filters are documented in https://openholidaysapi.org/swagger/v1/swagger.json .
