# v3 · 22 September 2026

- Added 13 direct data checks beyond the v2 sources and regional parsers/connectors for public warnings, transit, work zones, civic datasets and public notices/calendars.
- Added administrator feed discovery, credential/configuration diagnosis and real-network smoke checking.
- Introduced official / structured / observed / reported / community evidence labels; scheduled / forecast / live / unknown time semantics; event / current / discovery coverage scopes.
- Report separates dated overlaps from contextual information, displays source failure/partial/missing configuration, and never equates missing data with a clear or safe place.
- Alternatives are explicitly requested, reanalysed server-side and guarded against source degradation. Unresolved live information survives a date change; preferences persist; new trade-offs and lost “plan around” objectives are shown.
- Added search radius, opt-in local news and an internet-dependence option. Retained map selection, pixel visual identity, logo, fixed control heights and custom pickers.
- Repaired Ticketmaster request dates/geoPoint and unknown end-time handling, football dateTo exclusivity, TV programme selection/overlap/runtime uncertainty, UK subdivision/year coverage, MET period units/full-window coverage, solar/polar/overnight handling and TfL validity windows.
- Added Sources, revised Privacy, Terms, deployment metadata, source attribution and commercial-access gates. No invented legal entity or universal data licence.
- Strengthened input validation, source HTTP limits/caching/backoff, regional URL protections, XML parsing and request handling. No new runtime dependency was added.
- The ZIP contains source, setup docs, test fixtures and CI—not a hosted deployment or authenticated live-provider certification. See VALIDATION.md for actual checks and limits.
