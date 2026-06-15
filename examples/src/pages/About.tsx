import { usePage } from '../hooks/usePosts';
import { RichText } from '../components/RichText';
import { Spinner } from '../components/Spinner';

export function About() {
  const { data: page, isLoading } = usePage('about');

  return (
    <section className="article">
      <div className="container">
        <div className="kicker">o mně</div>

        {isLoading && <Spinner />}

        {page && (
          <>
            {page.title && <h1>{page.title}</h1>}
            {page.body && (
              <div style={{ marginTop: 24 }}>
                <RichText html={page.body} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
