export type EventPreference = 'avoid' | 'neutral' | 'plan_around';
export type EventKind = 'birthday' | 'dinner' | 'meetup' | 'workshop' | 'outdoor_activity' | 'screening' | 'other';
export type ConflictType = 'transport' | 'sport' | 'holiday' | 'weather' | 'daylight' | 'tv' | 'nearby_event';
export type SourceState = 'checked' | 'unavailable' | 'out_of_range' | 'not_applicable';

export interface VenueInput {
  address: string;
  lat?: number;
  lng?: number;
  name?: string;
  timezone?: string;
  countryCode?: string;
  state?: string;
  city?: string;
}

export interface EventInput {
  venue: VenueInput;
  /** Venue-local wall-clock value from <input type="datetime-local">. */
  dateTime: string;
  durationMinutes: number;
  eventKind: EventKind;
  isOutdoor: boolean;
  footballTeam?: string;
  programmeName?: string;
  programmeId?: number;
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
}

export interface SourceStatus {
  id: string;
  name: string;
  url: string;
  state: SourceState;
  checkedAt: string;
  message?: string;
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
}

export interface Report {
  event: EventInput;
  conflicts: Conflict[];
  suggestions: Suggestion[];
  checkedAt: string;
  sources: SourceStatus[];
  coverageGaps: string[];
}

export interface CheckResult {
  state: SourceState;
  data: Conflict[];
  source: string;
  sourceId: string;
  url: string;
  lastChecked: string;
  message?: string;
}

export interface PreferenceOverrides {
  [conflictId: string]: EventPreference;
}
