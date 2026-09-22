import Link from 'next/link';
import Logo from '@/components/Logo';

const providers = [
  {
    name: 'OpenStreetMap',
    use: 'Interactive map tiles',
    sent: 'Map area, zoom level and your IP address are sent by your browser when tiles load.',
    terms: 'https://operations.osmfoundation.org/policies/tiles/',
    privacy: 'https://osmfoundation.org/wiki/Privacy_Policy',
  },
  {
    name: 'Geoapify',
    use: 'Search, reverse geocoding and venue timezone',
    sent: 'Search text or selected coordinates. Requests go through this app, so your API key is not exposed in the browser.',
    terms: 'https://www.geoapify.com/terms-and-conditions/',
    privacy: 'https://www.geoapify.com/privacy-policy/',
  },
  {
    name: 'Ticketmaster',
    use: 'Nearby public events',
    sent: 'Approximate venue area and event time window.',
    terms: 'https://developer.ticketmaster.com/support/terms-of-use/',
    privacy: 'https://privacy.ticketmaster.com/privacy-policy',
  },
  {
    name: 'football-data.org',
    use: 'Selected football-team fixtures',
    sent: 'Fixture date window. The team name is used by this app to filter returned fixtures.',
    terms: 'https://www.football-data.org/client/register',
    privacy: 'https://www.football-data.org/about',
  },
  {
    name: 'TVmaze',
    use: 'Programme search and airing schedules',
    sent: 'Programme search text or programme ID and date.',
    terms: 'https://www.tvmaze.com/api#licensing',
    privacy: 'https://www.tvmaze.com/site/privacy',
  },
  {
    name: 'GOV.UK',
    use: 'UK bank holidays',
    sent: 'No venue-specific request. The public holiday feed is fetched and matched locally on the serverless function.',
    terms: 'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
    privacy: 'https://www.gov.uk/help/privacy-notice',
  },
  {
    name: 'MET Norway',
    use: 'Weather forecast',
    sent: 'Venue coordinates rounded to four decimal places.',
    terms: 'https://api.met.no/doc/TermsOfService',
    privacy: 'https://www.met.no/en/About-us/privacy',
  },
  {
    name: 'Sunrise-Sunset',
    use: 'Sunrise and sunset',
    sent: 'Venue coordinates, date and timezone.',
    terms: 'https://sunrise-sunset.org/terms',
    privacy: 'https://sunrise-sunset.org/privacy',
  },
  {
    name: 'Transport for London',
    use: 'London transport disruptions',
    sent: 'Venue coordinates and event date for London events only.',
    terms: 'https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service',
    privacy: 'https://tfl.gov.uk/corporate/privacy-and-cookies/',
  },
];

export default function DataPage() {
  return (
    <div className="info-page">
      <header className="site-header info-header">
        <Link className="brand" href="/"><Logo size={30} /><strong>BAD TIMING</strong></Link>
        <Link className="plain-link" href="/">Back</Link>
      </header>

      <main className="info-shell">
        <section className="info-intro">
          <h1>Data & privacy</h1>
          <p>BAD TIMING has no accounts, database, analytics or advertising in this codebase. Your event is checked only when you ask.</p>
        </section>

        <section className="info-section">
          <h2>How it works</h2>
          <div className="info-grid two">
            <article><h3>Your event</h3><p>The place, time, duration and optional interests are sent to this app&apos;s serverless API. They are not stored in a database.</p></article>
            <article><h3>Temporary cache</h3><p>Some public API responses are kept in server memory for a short time to reduce repeat calls. The cache disappears when that server instance is recycled.</p></article>
            <article><h3>The map</h3><p>OpenStreetMap tiles load directly in your browser. OpenStreetMap therefore receives ordinary web-request data such as your IP address.</p></article>
            <article><h3>Your host</h3><p>This repository does not choose a hosting provider. The provider you deploy on may keep request or security logs under its own policy.</p></article>
          </div>
        </section>

        <section className="info-section">
          <h2>Why there is a small serverless layer</h2>
          <p className="info-copy">Several provider credentials must not be published in browser code, and MET Norway expects production clients to identify themselves properly. The serverless routes keep those credentials private and proxy the checks. There is no application server or database to operate.</p>
        </section>

        <section className="info-section">
          <h2>Processors and third parties</h2>
          <p className="info-copy">Your hosting provider is the main infrastructure processor for this app once you deploy it. The services below provide external data; they are not automatically all “subprocessors” in the GDPR sense. For example, OpenStreetMap Foundation states that use of its public services does not create a controller–processor relationship. Update this page after you choose a host and before publishing your own privacy notice.</p>
        </section>

        <section className="info-section">
          <h2>Attribution</h2>
          <div className="attribution-list">
            <span>Map © OpenStreetMap contributors</span>
            <span>Location data: Geoapify / OpenStreetMap</span>
            <span>Football data provided by the Football-Data.org API</span>
            <span>Weather data: MET Norway, CC BY 4.0</span>
            <span>Daylight: <a href="https://sunrise-sunset.org/" target="_blank" rel="noreferrer">Sunrise-Sunset.org</a></span>
            <span>TV data: <a href="https://www.tvmaze.com/" target="_blank" rel="noreferrer">TVmaze</a>, CC BY-SA</span>
            <span>Powered by TfL Open Data</span>
            <span>Contains OS data © Crown copyright and database rights 2016</span>
            <span>Geomni UK Map data © and database rights 2019</span>
            <span>Contains public sector information licensed under the Open Government Licence v3.0</span>
          </div>
        </section>

        <section className="info-section">
          <h2>Data providers</h2>
          <div className="provider-list">
            {providers.map((provider) => (
              <article className="provider-card" key={provider.name}>
                <div><h3>{provider.name}</h3><p>{provider.use}</p></div>
                <p>{provider.sent}</p>
                <div className="provider-links"><a href={provider.terms} target="_blank" rel="noreferrer">Terms ↗</a><a href={provider.privacy} target="_blank" rel="noreferrer">Privacy ↗</a></div>
              </article>
            ))}
          </div>
        </section>

        <section className="info-section">
          <h2>Before a public launch</h2>
          <div className="info-grid two">
            <article><h3>Hosting</h3><p>Add your actual hosting provider to this page and to your privacy notice if it processes visitor data for you.</p></article>
            <article><h3>Commercial use</h3><p>Review each provider&apos;s current terms first. Ticketmaster in particular restricts some revenue-generating uses of its API.</p></article>
            <article><h3>Map traffic</h3><p>OpenStreetMap&apos;s public tile service is suitable for normal interactive use, but it is not a commercial SLA. Change tile provider if traffic becomes significant.</p></article>
            <article><h3>Terms change</h3><p>Provider terms and limits can change. The links above are the source of truth.</p></article>
          </div>
        </section>

        <footer className="info-footer">Last reviewed 22 September 2026.</footer>
      </main>
    </div>
  );
}
