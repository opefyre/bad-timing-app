export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (value: number) => value * Math.PI / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function geohash(lat: number, lon: number, precision = 9): string {
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90; let maxLat = 90;
  let minLon = -180; let maxLon = 180;
  let even = true;
  let bit = 0;
  let ch = 0;
  let hash = '';

  while (hash.length < precision) {
    if (even) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) { ch |= 1 << (4 - bit); minLon = mid; } else { maxLon = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch |= 1 << (4 - bit); minLat = mid; } else { maxLat = mid; }
    }
    even = !even;
    if (bit < 4) bit += 1;
    else {
      hash += base32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

export function isGreaterLondon(lat: number, lng: number): boolean {
  return lat >= 51.28 && lat <= 51.70 && lng >= -0.52 && lng <= 0.35;
}
