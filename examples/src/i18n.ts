import { createContext, useContext } from 'react';

export const LANGS = ['cs', 'en'] as const;
export type Lang = (typeof LANGS)[number];

export function isLang(value: string | undefined): value is Lang {
  return (LANGS as readonly string[]).includes(value ?? '');
}

/** The language a first-time visitor gets at `/`: Czech for Czech browsers, English otherwise. */
export function preferredLang(languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith('cs') || l.toLowerCase().startsWith('sk')) ? 'cs' : 'en';
}

/** Path segment of each section, per language. */
const SECTIONS = {
  project: { cs: 'projekty', en: 'projects' },
  about: { cs: 'o-mne', en: 'about' },
} as const;
type Section = keyof typeof SECTIONS;

export const paths = {
  home: (lang: Lang) => `/${lang}`,
  project: (lang: Lang, id: string) => `/${lang}/${SECTIONS.project[lang]}/${id}`,
  about: (lang: Lang) => `/${lang}/${SECTIONS.about[lang]}`,
};

/** Every segment a section answers to, so a link shared in one language still opens in the other. */
export const sectionSegments = (section: Section) => Object.values(SECTIONS[section]) as string[];

/** The same page in another language: `/cs/projekty/42` becomes `/en/projects/42`. */
export function translatePath(pathname: string, to: Lang): string {
  const [, , segment, ...rest] = pathname.split('/');
  if (!segment) return paths.home(to);
  const section = (Object.keys(SECTIONS) as Section[]).find((s) => sectionSegments(s).includes(segment));
  if (!section) return paths.home(to);
  return ['', to, SECTIONS[section][to], ...rest].join('/');
}

const cs = {
  locale: 'cs-CZ',
  langName: 'Česky',
  nav: { projects: 'Projekty', about: 'O mně', switchTo: 'Switch to English' },
  menuOpen: 'Otevřít menu',
  menuClose: 'Zavřít menu',
  home: {
    title: 'Věci, které stavím a zkouším.',
    subtitle: 'Portfolio Pavla Flajšmana: weby, nástroje a experimenty, na kterých pracuji.',
  },
  projects: {
    all: 'Vše',
    filterLabel: 'Filtrovat podle technologie',
    empty: 'Zatím tu nejsou žádné projekty.',
    emptyFiltered: 'S touto technologií tu zatím nic není.',
    showAll: 'Zobrazit všechny projekty',
    loadError: 'Projekty se nepodařilo načíst. Zkuste stránku obnovit.',
  },
  project: {
    back: 'Všechny projekty',
    year: 'Rok',
    role: 'Role',
    stack: 'Technologie',
    links: 'Odkazy',
    live: 'Otevřít web',
    repo: 'Zdrojový kód',
    gallery: 'Galerie',
    notFound: 'Tento projekt neexistuje nebo už není zveřejněný.',
  },
  about: { fallbackTitle: 'O mně', empty: 'Text této stránky se připravuje.' },
  notFound: { title: 'Tahle stránka neexistuje.', home: 'Zpět na projekty' },
  loading: 'Načítám…',
  footer: { poweredBy: 'Běží na TheCMS' },
};

const en: typeof cs = {
  locale: 'en-GB',
  langName: 'English',
  nav: { projects: 'Projects', about: 'About', switchTo: 'Přepnout do češtiny' },
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  home: {
    title: 'Things I build and try out.',
    subtitle: 'The portfolio of Pavel Flajšman: websites, tools and experiments I work on.',
  },
  projects: {
    all: 'All',
    filterLabel: 'Filter by technology',
    empty: 'There are no projects here yet.',
    emptyFiltered: 'Nothing uses this technology yet.',
    showAll: 'Show all projects',
    loadError: 'The projects could not be loaded. Try refreshing the page.',
  },
  project: {
    back: 'All projects',
    year: 'Year',
    role: 'Role',
    stack: 'Stack',
    links: 'Links',
    live: 'Visit site',
    repo: 'Source code',
    gallery: 'Gallery',
    notFound: 'This project does not exist or is no longer published.',
  },
  about: { fallbackTitle: 'About', empty: 'This page is being written.' },
  notFound: { title: 'This page does not exist.', home: 'Back to projects' },
  loading: 'Loading…',
  footer: { poweredBy: 'Runs on TheCMS' },
};

export const dictionaries: Record<Lang, typeof cs> = { cs, en };
export type Dictionary = typeof cs;

export const LangContext = createContext<Lang>('en');

/** The current language and its UI strings. */
export function useLang(): { lang: Lang; t: Dictionary } {
  const lang = useContext(LangContext);
  return { lang, t: dictionaries[lang] };
}
