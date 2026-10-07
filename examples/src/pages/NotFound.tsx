import { Link } from 'react-router-dom';
import { paths, useLang } from '../i18n';

export function NotFound() {
  const { lang, t } = useLang();
  return (
    <section className="container page not-found">
      <p className="not-found-code" aria-hidden="true">
        404
      </p>
      <h1>{t.notFound.title}</h1>
      <Link to={paths.home(lang)} className="btn">
        {t.notFound.home}
      </Link>
    </section>
  );
}
