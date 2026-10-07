import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LabMark } from './LabMark';
import { LANGS, paths, translatePath, useLang } from '../i18n';
import { config } from '../config';

export function Header() {
  const { lang, t } = useLang();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

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
      <div className="container inner">
        <Link to={paths.home(lang)} className="logo">
          <LabMark className="logo-mark" />
          {config.siteTitle}
        </Link>

        <nav className={`site-nav ${open ? 'is-open' : ''}`} id="site-nav">
          <NavLink to={paths.home(lang)} end>
            {t.nav.projects}
          </NavLink>
          <NavLink to={paths.about(lang)}>{t.nav.about}</NavLink>
          <div className="lang-switch" role="group" aria-label={t.langName}>
            {LANGS.map((l) => (
              <Link
                key={l}
                to={translatePath(location.pathname, l) + location.search}
                hrefLang={l}
                lang={l}
                aria-current={l === lang ? 'true' : undefined}
                aria-label={l === lang ? undefined : t.nav.switchTo}
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </div>
        </nav>

        <button
          type="button"
          className="nav-toggle"
          aria-label={open ? t.menuClose : t.menuOpen}
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
