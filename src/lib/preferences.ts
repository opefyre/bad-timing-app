import { ConflictType, EventInput, EventPreference } from '@/types';

export function defaultPreference(type: ConflictType, input: EventInput): EventPreference {
  if ((type === 'sport' || type === 'tv') && input.eventKind === 'screening') return 'plan_around';
  if (type === 'sport' && input.footballTeam) return 'avoid';
  if (type === 'tv' && input.programmeName) return 'avoid';
  if (type === 'transport') return 'avoid';
  if ((type === 'weather' || type === 'daylight') && input.isOutdoor) return 'avoid';
  return 'neutral';
}
