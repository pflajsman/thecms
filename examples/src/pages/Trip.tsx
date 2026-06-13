import { useEffect, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTrip, useMedia } from '../hooks/usePosts';
import { TripMap } from '../components/TripMap';
import { RichText } from '../components/RichText';
import { Spinner, ErrorState } from '../components/Spinner';
import { formatDate } from '../lib/format';
import { config } from '../config';

export function Trip() {
  const { id } = useParams();
  const { data: trip, isLoading, isError, error } = useTrip(id);
  // gpxUrl may be a full URL or a media id — resolve to a real file URL.
  const {
    data: gpx,
    isLoading: gpxLoading,
    isError: gpxError,
    error: gpxErr,
  } = useMedia(trip?.gpxUrl);
  // Distance computed from the GPX, used when the CMS field is empty.
  const [computedKm, setComputedKm] = useState<number | null>(null);

  const handleDistance = useCallback((km: number) => setComputedKm(km), []);

  useEffect(() => {
    if (trip) document.title = `${trip.title} — ${config.siteTitle}`;
    return () => {
      document.title = config.siteTitle;
    };
  }, [trip]);

  if (isLoading) return <Spinner />;
  if (isError || !trip)
    return (
      <div className="container">
        <ErrorState message={(error as Error)?.message || 'Výlet nenalezen.'} />
        <div style={{ textAlign: 'center' }}>
          <Link to="/trips" className="back">
            ← zpět na výlety
          </Link>
        </div>
      </div>
    );

  const distance = trip.distanceKm ?? computedKm ?? undefined;

  return (
    <article className="article">
      <div className="container">
        <Link to="/trips" className="back">
          ← zpět na výlety
        </Link>
        <div className="kicker">
          {formatDate(trip.date)}
          {distance ? ` · ${distance} km` : ''}
        </div>
        <h1>{trip.title}</h1>

        {gpx ? (
          <div style={{ margin: '28px 0' }}>
            <TripMap gpxUrl={gpx.url} onDistance={handleDistance} />
            <div style={{ marginTop: 12 }}>
              <a className="btn" href={gpx.url} download={gpx.filename}>
                ↓ Stáhnout GPX
              </a>
            </div>
          </div>
        ) : trip.gpxUrl && gpxLoading ? (
          <p style={{ color: 'var(--muted)', margin: '20px 0' }}>Načítám trasu…</p>
        ) : trip.gpxUrl && gpxError ? (
          <p style={{ color: 'var(--muted)', margin: '20px 0' }}>
            Trasu se nepodařilo načíst: {(gpxErr as Error)?.message || 'neznámá chyba'}
          </p>
        ) : (
          <p style={{ color: 'var(--muted)', margin: '20px 0' }}>
            (K tomuto výletu zatím není nahraná GPX trasa.)
          </p>
        )}

        {trip.body && <RichText html={trip.body} />}
      </div>
    </article>
  );
}
