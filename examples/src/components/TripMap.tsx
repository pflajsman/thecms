import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { parseGpx, trackDistanceKm, type LatLng } from '../lib/gpx';

interface TripMapProps {
  gpxUrl: string;
  /** Optional callback with the computed distance once the track is parsed. */
  onDistance?: (km: number) => void;
  height?: number;
}

/**
 * Renders a GPX track as a route line on a Leaflet map (OpenStreetMap tiles).
 * Fetches and parses the GPX client-side, fits the map to the route bounds,
 * and marks the start (lime) and end (black).
 */
export function TripMap({ gpxUrl, onDistance, height = 420 }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(gpxUrl);
        if (!res.ok) throw new Error(`Nepodařilo se načíst trasu (${res.status}).`);
        const xml = await res.text();
        const points: LatLng[] = parseGpx(xml);
        if (cancelled) return;
        if (points.length === 0) throw new Error('GPX neobsahuje žádné body trasy.');

        onDistance?.(trackDistanceKm(points));

        // (Re)create the map
        if (!containerRef.current) return;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        const map = L.map(containerRef.current, { scrollWheelZoom: false });
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 18,
        }).addTo(map);

        const line = L.polyline(points, { color: '#0a0a0a', weight: 4, opacity: 0.9 }).addTo(map);

        // Start / end markers
        const dot = (color: string) =>
          L.divIcon({
            className: '',
            html: `<span style="display:block;width:14px;height:14px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px #0a0a0a"></span>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          });
        L.marker(points[0], { icon: dot('#c6ff00') }).addTo(map).bindPopup('Start');
        L.marker(points[points.length - 1], { icon: dot('#0a0a0a') }).addTo(map).bindPopup('Cíl');

        map.fitBounds(line.getBounds(), { padding: [24, 24] });
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [gpxUrl, onDistance]);

  if (error) {
    return (
      <div className="state" style={{ padding: '40px 0' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={containerRef}
        style={{ height, width: '100%', border: '2px solid var(--line)', background: '#f4f4f4' }}
      />
      {loading && (
        <div
          className="mono"
          style={{ position: 'absolute', top: 12, left: 12, fontSize: '0.78rem', color: 'var(--muted)' }}
        >
          načítám trasu…
        </div>
      )}
    </div>
  );
}
