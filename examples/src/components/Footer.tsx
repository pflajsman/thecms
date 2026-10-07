import { Link } from 'react-router-dom';
import { paths, useLang } from '../i18n';
import { config } from '../config';

export function Footer() {
  const { lang, t } = useLang();
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container inner">
        <span>
          © {year} Pavel Flajšman, {config.siteTitle}
        </span>
        <nav aria-label={config.siteTitle}>
          <Link to={paths.home(lang)}>{t.nav.projects}</Link>
          <Link to={paths.about(lang)}>{t.nav.about}</Link>
        </nav>
        <span className="muted">{t.footer.poweredBy}</span>
      </div>
    </footer>
  );
}
