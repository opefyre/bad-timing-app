import { Conflict, ConflictType, EventInput, EventPreference, PreferenceOverrides } from '@/types';

export function defaultPreference(type: ConflictType, input: EventInput): EventPreference {
  if ((type === 'sport' || type === 'tv') && input.eventKind === 'screening') return 'plan_around';
  if (type === 'sport' && (input.footballTeams?.length || input.footballTeam)) return 'avoid';
  if (type === 'tv' && input.programmeName) return 'avoid';
  if (['transport','road','warning'].includes(type)) return 'avoid';
  if ((type === 'weather' || type === 'daylight') && input.isOutdoor) return 'avoid';
  return 'neutral';
}

export function preferenceKey(conflict:Conflict):string{return conflict.policyKey||conflict.id;}
export function preferenceFor(conflict:Conflict,overrides:PreferenceOverrides):EventPreference{
 const keys=[preferenceKey(conflict),conflict.id,...(conflict.aliases??[])];
 for(const key of keys)if(Object.hasOwn(overrides,key))return overrides[key];return conflict.preference;
}
