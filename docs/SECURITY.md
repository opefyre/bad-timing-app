# Security and deployment boundaries

Secrets must stay in `.env.local` / the hosting secret store; never `NEXT_PUBLIC_`, source control, feed URLs, screenshots or public logs. The archive excludes local credentials and old Git history. Rotate keys previously shared elsewhere. Restrict provider credentials to the available APIs and set hard quota/spending limits.

The browser can submit only validated event/preferences/mode data to the API. Alternative comparisons are recomputed server-side; an arbitrary client-supplied “base report” is not trusted. Same-origin checks, JSON-only bounded bodies, sanitised errors and per-instance request safeguards are present. Application endpoints should additionally have a host/edge firewall and global rate/budget rules. IP headers are only trustworthy when your proxy overwrites them: the in-memory limiter is not distributed and is not an authentication mechanism.

Public provider HTTP has an eight-second timeout including body read, five-MB response cap, bounded in-memory cache, in-flight deduplication, conditional request support, provider 429 cooldown and short error backoff. Source errors never become green empty results. An upstream cache policy can override the application TTL. Caches can contain public search results, and process lifecycle determines physical eviction; do not claim universal immediate deletion.

Regional URLs are configuration-controlled, not visitor inputs. The feed reader restricts scheme, port and hosts, verifies public DNS answers, rejects private/link-local addresses and redirects, and refuses cross-host credential forwarding. Only approve publishers you trust. DNS verification is not a substitute for egress restrictions or network-level DNS-rebinding protection; a public host can change its answers. Do not expose arbitrary configuration editing to visitors.

XML parsing rejects DTD/entity declarations, limits size/depth/node counts, and does not fetch external entities. HTML is stripped from source summaries; React escapes strings; source URLs accept only web schemes without embedded credentials. The bounded GTFS/CSV/ICS parsers are not full third-party standards validators. Inputs outside the implemented subset are rejected or flagged as partial.

Use HTTPS. Maintain dependencies and run the included Linux CI build. Check host logs and retention; this repository does not configure or erase your platform's access logs. Browser map tiles go directly to OpenStreetMap; do not hide this in the privacy notice. A production Content Security Policy must account for Next runtime scripts, Leaflet, and OSM tile requests; deploy and test a CSP with your host rather than copying an unverified restrictive header.

No system audit, penetration test, legal review, or guarantee of upstream availability is implied by passing the automated tests.
