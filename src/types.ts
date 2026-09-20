export type EventPreference = 'avoid' | 'neutral' | 'plan_around';

export interface VenueInput {
  address: string;
  lat?: number;
  lng?: number;
  name?: string;
}

export interface EventInput {
  venue: VenueInput;
  dateTime: string;
  durationMinutes: number;
  isOutdoor: boolean;
  footballTeam?: string;
  programmeName?: string;
}

export interface Conflict {
  id: string;
  type: 'transport' | 'sport' | 'holiday' | 'weather' | 'daylight' | 'tv' | 'nearby_event';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source: string;
  sourceUrl?: string;
  preference: EventPreference;
  dateTime?: string;
  distance?: number;
}

export interface Suggestion {
  change: string;
  newDateTime?: string;
  conflictsResolved: string[];
  conflictsRemaining: string[];
  conflictsAdded: string[];
}

export interface Report {
  conflicts: Conflict[];
  suggestions: Suggestion[];
  checkedAt: string;
  sources: { name: string; url: string; lastChecked: string }[];
  coverageGaps: string[];
}

export interface CheckResult {
  success: boolean;
  data?: Conflict[];
  error?: string;
  source: string;
  lastChecked: string;
}
