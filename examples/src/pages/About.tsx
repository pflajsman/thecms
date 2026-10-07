import { usePage } from '../hooks/useContent';
import { RichText } from '../components/RichText';
import { MediaImage } from '../components/MediaImage';
import { Spinner } from '../components/Spinner';
import { useLang } from '../i18n';

export function About() {
  const { t } = useLang();
  const { data: page, isLoading } = usePage('about');

  if (isLoading) return <Spinner />;

  return (
    <article className="container page about">
      <div className={`about-grid ${page?.image ? 'has-image' : ''}`}>
        {page?.image && (
          <div className="plate tint-lilac about-portrait">
            <MediaImage id={page.image} alt="Pavel Flajšman" eager />
          </div>
        )}
        <div>
          <h1>{page?.title || t.about.fallbackTitle}</h1>
          {page?.subtitle && <p className="lead">{page.subtitle}</p>}
          {page?.body ? <RichText html={page.body} /> : <p className="muted">{t.about.empty}</p>}
        </div>
      </div>
    </article>
  );
}
