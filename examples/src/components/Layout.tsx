import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { Header } from './Header';
import { Footer } from './Footer';
import { NotFound } from '../pages/NotFound';
import { LangContext, isLang, preferredLang } from '../i18n';
import { config } from '../config';

export function Layout() {
  const { lang: param } = useParams();
  const valid = isLang(param);
  const lang = valid ? param : preferredLang();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = config.siteTitle;
  }, [lang]);

  return (
    <LangContext.Provider value={lang}>
      <a className="skip-link" href="#main">
        {lang === 'cs' ? 'Přeskočit na obsah' : 'Skip to content'}
      </a>
      <Header />
      <main id="main">{valid ? <Outlet /> : <NotFound />}</main>
      <Footer />
    </LangContext.Provider>
  );
}
