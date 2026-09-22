const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function localParts(localDateTime: string) {
  const match = LOCAL_RE.exec(localDateTime);
  if (!match) throw new Error('Choose a valid date and time.');
  const p = { year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5], second: +(match[6] ?? 0) };
  const d = new Date(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second));
  if(p.year<2000 || p.year>2100 || d.getUTCFullYear()!==p.year || d.getUTCMonth()+1!==p.month || d.getUTCDate()!==p.day || p.hour>23 || p.minute>59 || p.second>59) throw new Error('Choose a valid date and time.');
  return p;
}
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone:string) {
  let f = formatters.get(timeZone);
  if(!f) { f=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}); if(formatters.size>100)formatters.clear(); formatters.set(timeZone,f); }
  return f;
}
export function instantToLocal(instant: Date | string, timeZone: string):string {
  const v=Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:${v.second}`;
}
export function possibleInstants(localDateTime:string,timeZone:string):Date[] {
  const p=localParts(localDateTime), wall=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second);
  const target=`${localDateTime.slice(0,16)}:${String(p.second).padStart(2,'0')}`;
  const candidates=new Set<number>();
  for(const hours of [-36,-12,0,12,36]) {
    const probe=wall+hours*3600000;
    const local=instantToLocal(new Date(probe),timeZone);
    const offset=new Date(local+'Z').getTime()-probe;
    const result=wall-offset;
    if(instantToLocal(new Date(result),timeZone)===target)candidates.add(result);
  }
  return [...candidates].sort((a,b)=>a-b).map(n=>new Date(n));
}
export function zonedLocalToUtc(localDateTime:string,timeZone:string):Date {
  const dates=possibleInstants(localDateTime,timeZone);
  if(!dates.length)throw new Error('That local time does not exist because the clocks change. Choose another time.');
  // A repeated wall time uses its first occurrence. The report discloses this choice.
  return dates[0];
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
