const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

function localParts(localDateTime: string) {
  const match = LOCAL_RE.exec(localDateTime);
  if (!match) throw new Error('Invalid local date/time');
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? 0),
  };
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - date.getTime();
}

export function zonedLocalToUtc(localDateTime: string, timeZone: string): Date {
  const p = localParts(localDateTime);
  const wallClockUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  let guess = new Date(wallClockUtc);
  for (let i = 0; i < 3; i += 1) {
    const offset = timezoneOffsetMs(guess, timeZone);
    guess = new Date(wallClockUtc - offset);
  }
  return guess;
}

export function addLocalMinutes(localDateTime: string, minutes: number): string {
  const p = localParts(localDateTime);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function addLocalDays(localDateTime: string, days: number): string {
  return addLocalMinutes(localDateTime, days * 24 * 60);
}

export function localDate(localDateTime: string): string {
  return localDateTime.slice(0, 10);
}

export function eventWindow(localDateTime: string, durationMinutes: number, timezone: string) {
  const start = zonedLocalToUtc(localDateTime, timezone);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function formatInstant(iso: string, timezone: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    ...options,
  }).format(new Date(iso));
}

export function formatLocalDateTime(localDateTime: string): string {
  const p = localParts(localDateTime);
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute));
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function minuteDistance(a: string, b: string): number {
  const pa = localParts(a);
  const pb = localParts(b);
  const am = Date.UTC(pa.year, pa.month - 1, pa.day, pa.hour, pa.minute);
  const bm = Date.UTC(pb.year, pb.month - 1, pb.day, pb.hour, pb.minute);
  return Math.abs(Math.round((bm - am) / 60_000));
}
