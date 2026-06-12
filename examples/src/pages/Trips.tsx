import { Link } from 'react-router-dom';
import { useTrips } from '../hooks/usePosts';
import { Spinner, ErrorState } from '../components/Spinner';
import { formatDate, num } from '../lib/format';

export function Trips() {
  const { data, isLoading, isError, error } = useTrips();

  return (
    <section className="article">
      <div className="container">
        <div className="kicker">na kole</div>
        <h1>Výlety na kole</h1>
        <p style={{ color: 'var(--muted)', marginTop: 12, marginBottom: 8 }}>
          Trasy mých vyjížděk — každá s mapou.
        </p>

        {isLoading && <Spinner />}
        {isError && <ErrorState message={(error as Error)?.message || 'Nepodařilo se načíst výlety.'} />}

        {data && data.trips.length === 0 && (
          <div className="state">
            <p>Zatím tu žádný výlet není.</p>
          </div>
        )}

        {data && data.trips.length > 0 && (
          <ul className="post-list" style={{ marginTop: 24 }}>
            {data.trips.map((trip, i) => (
              <li className="post-row" key={trip.id}>
                <Link to={`/trips/${trip.id}`}>
                  <span className="num">{num(i + 1)}</span>
                  <span>
                    <span className="title">{trip.title}</span>
                    <span className="excerpt">
                      {trip.distanceKm ? `${trip.distanceKm} km · ` : ''}
                      {trip.summary}
                    </span>
                  </span>
                  <span className="date">{formatDate(trip.date)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
