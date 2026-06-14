import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile menu overlay is open.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="site-header">
      <div className="container-wide inner">
        <NavLink to="/" className="logo">
          flajsman<span className="dot">.cz</span>
        </NavLink>

        <nav className={`site-nav ${open ? 'is-open' : ''}`} id="site-nav">
          <NavLink to="/" end>
            psaní
          </NavLink>
          <NavLink to="/trips">na kole</NavLink>
          <NavLink to="/about">o mně</NavLink>
          <NavLink to="/contact">kontakt</NavLink>
        </nav>

        <button
          type="button"
          className={`nav-toggle ${open ? 'is-open' : ''}`}
          aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
          <span className="nav-toggle-bar" />
        </button>
      </div>

      {open && <div className="nav-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
    </header>
  );
}
