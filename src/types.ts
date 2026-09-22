export type EventPreference = 'avoid' | 'neutral' | 'plan_around';
export type EventKind = 'birthday' | 'dinner' | 'meetup' | 'workshop' | 'outdoor_activity' | 'screening' | 'other';
export type ConflictType = 'transport' | 'sport' | 'holiday' | 'weather' | 'daylight' | 'tv' | 'nearby_event' | 'road' | 'warning' | 'hazard' | 'air_quality' | 'news' | 'civic' | 'internet';
export type SourceState = 'checked' | 'unavailable' | 'out_of_range' | 'not_applicable' | 'not_configured' | 'partial' | 'disabled';

export interface VenueInput {
  address: string;
  lat?: number;
  lng?: number;
  name?: string;
  timezone?: string;
  countryCode?: string;
  state?: string;
  city?: string;
  subdivisionCode?: string;
  countryName?: string;
}

export interface FootballTeam {
  id: number;
  name: string;
}

export interface EventInput {
  venue: VenueInput;
  /** Venue-local wall-clock value from the custom date/time picker. */
  dateTime: string;
  durationMinutes: number;
  eventKind: EventKind;
  isOutdoor: boolean;
  /** Teams followed by this group; fixtures are checked for any of them. */
  footballTeams?: FootballTeam[];
  /** Legacy single team string; still accepted when footballTeams is absent. */
  footballTeam?: string;
  programmeName?: string;
  programmeId?: number;
  radiusKm?: number;
  includeNews?: boolean;
  needsInternet?: boolean;
}

export interface Conflict {
  id: string;
  type: ConflictType;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl?: string;
  preference: EventPreference;
  startsAt?: string;
  endsAt?: string;
  distanceKm?: number;
  placeName?: string;
  providerId?: string;
  policyKey?: string;
  evidence?: 'official' | 'structured' | 'observed' | 'reported' | 'community';
  timing?: 'scheduled' | 'forecast' | 'live' | 'unknown';
  resolutionEligible?: boolean;
  relevance?: 'overlap' | 'context';
  observedAt?: string;
  retrievedAt?: string;
  areaLabel?: string;
  caveat?: string;
  aliases?: string[];
  relatedSources?: Array<{ name: string; url: string }>;
  publisherSeverity?: string;
  certainty?: string;
}

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  state: SourceState;
  checkedAt: string;
  message?: string;
  scope?: 'event' | 'current' | 'discovery';
  limitations?: string[];
  fetchedAt?: string;
  itemCount?: number;
}

export interface Suggestion {
  mode: 'earlier' | 'another_day';
  change: string;
  newDateTime: string;
  conflictsResolved: string[];
  conflictsRemaining: string[];
  conflictsAdded: string[];
  planAroundKept: string[];
  avoidCount: number;
  changeMinutes: number;
  unresolvedContext?: string[];
  planAroundLost?: string[];
  planAroundImproved?: string[];
  checkedAt?: string;
  coverageNote?: string;
  candidateCount?: number;
}

export interface Report {
  event: EventInput;
  conflicts: Conflict[];
  suggestions: Suggestion[];
  checkedAt: string;
  sources: SourceStatus[];
  coverageGaps: string[];
  notices?: string[];
  reportToken?: string;
  alternativeNote?: string;
}

export interface CheckResult {
  state: SourceState;
  data: Conflict[];
  source: string;
  sourceId: string;
  url: string;
  lastChecked: string;
  message?: string;
  scope?: 'event' | 'current' | 'discovery';
  limitations?: string[];
  fetchedAt?: string;
  itemCount?: number;
}

export interface PreferenceOverrides {
  [conflictId: string]: EventPreference;
}
