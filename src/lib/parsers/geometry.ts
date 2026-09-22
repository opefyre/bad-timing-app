import { EventInput } from '@/types';
import { arr, obj, num } from '../connectors/util';
import { haversineKm } from '../geo';
type Point = [number, number];
function point(value: unknown): Point | undefined { const a = arr(value); const x = num(a[0]); const y = num(a[1]); return x !== undefined && y !== undefined && Math.abs(x) <= 180 && Math.abs(y) <= 90 ? [x, y] : undefined; }
export function inRing(p: Point, raw: unknown): boolean {
  const ring = arr(raw).map(point).filter((v): v is Point => !!v); let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function lineDistance(p: Point, raw: unknown): number {
  const pts = arr(raw).map(point).filter((v): v is Point => !!v);
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    best = Math.min(best, haversineKm(p[1], p[0], pts[i][1], pts[i][0]));
    if (i === 0) continue;
    const a = pts[i - 1], b = pts[i];
    const cos = Math.cos(p[1] * Math.PI / 180);
    const dx = (b[0] - a[0]) * cos, dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, (((p[0] - a[0]) * cos) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, haversineKm(p[1], p[0], a[1] + t * dy, a[0] + t * (b[0] - a[0])));
  }
  return best;
}
/** GeoJSON positions are longitude, latitude. CAP reverses these; convert before calling. */
export function geometryDistance(input: EventInput, geometry: unknown): number {
  const g = obj(geometry); const p: Point = [input.venue.lng!, input.venue.lat!];
  const coords = arr(g.coordinates);
  if (g.type === 'Point') { const q = point(coords); return q ? haversineKm(p[1], p[0], q[1], q[0]) : Infinity; }
  if (g.type === 'LineString') return lineDistance(p, coords);
  if (g.type === 'MultiPoint') return Math.min(...coords.map(c => geometryDistance(input, {type:'Point',coordinates:c})));
  if (g.type === 'MultiLineString') return Math.min(...coords.map(c => lineDistance(p, c)));
  if (g.type === 'Polygon') {
    if (inRing(p, coords[0]) && !coords.slice(1).some(h => inRing(p, h))) return 0;
    return Math.min(...coords.map(c => lineDistance(p, c)));
  }
  if (g.type === 'MultiPolygon') return Math.min(...coords.map(c => geometryDistance(input, { type: 'Polygon', coordinates: c })));
  if (g.type === 'GeometryCollection') return Math.min(...arr(g.geometries).map(c => geometryDistance(input, c)));
  return Infinity;
}
