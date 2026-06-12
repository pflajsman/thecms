import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <section className="article">
      <div className="container" style={{ textAlign: 'center', padding: '96px 0' }}>
        <h1 className="display" style={{ fontSize: 'clamp(3rem, 12vw, 7rem)' }}>
          404
        </h1>
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>Tahle stránka neexistuje.</p>
        <Link to="/" className="btn" style={{ marginTop: 28 }}>
          Domů
        </Link>
      </div>
    </section>
  );
}
