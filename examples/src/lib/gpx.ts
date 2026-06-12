/**
 * Minimal GPX parser. Extracts the ordered list of track/route points as
 * [lat, lng] pairs. Handles <trkpt> (tracks), and falls back to <rtept>
 * (routes) and <wpt> (waypoints) if no track points are present.
 */
export type LatLng = [number, number];

export function parseGpx(xml: string): LatLng[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Neplatný GPX soubor.');
  }

  const collect = (selector: string): LatLng[] =>
    Array.from(doc.querySelectorAll(selector))
      .map((el) => {
        const lat = parseFloat(el.getAttribute('lat') || '');
        const lon = parseFloat(el.getAttribute('lon') || '');
        return Number.isFinite(lat) && Number.isFinite(lon) ? ([lat, lon] as LatLng) : null;
      })
      .filter((p): p is LatLng => p !== null);

  const track = collect('trkpt');
  if (track.length) return track;

  const route = collect('rtept');
  if (route.length) return route;

  return collect('wpt');
}

/** Rough total distance of a track in kilometres (haversine). */
export function trackDistanceKm(points: LatLng[]): number {
  const R = 6371;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return Math.round(total * 10) / 10;
}
