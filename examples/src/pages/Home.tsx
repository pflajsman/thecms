import { useState } from 'react';
import { usePosts } from '../hooks/usePosts';
import { PostRow } from '../components/PostRow';
import { Spinner, ErrorState } from '../components/Spinner';

const PAGE_SIZE = 10;

export function Home() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error } = usePosts(page, PAGE_SIZE);

  return (
    <>
      <section className="intro">
        <div className="container">
          <h1 className="display">
            Píšu o&nbsp;kódu,
            <br />
            designu a&nbsp;všem mezi.
          </h1>
          <p className="tagline">
            Osobní blog Pavla Flajšmana. <strong>Myšlenky</strong>, poznámky a&nbsp;experimenty —
            publikované přes vlastní headless CMS.
          </p>
        </div>
      </section>

      <section className="container">
        <div className="section-label">psaní</div>

        {isLoading && <Spinner />}
        {isError && <ErrorState message={(error as Error)?.message || 'Nepodařilo se načíst příspěvky.'} />}

        {data && data.posts.length === 0 && (
          <div className="state">
            <p>Zatím tu nic není. Brzy přibyde první příspěvek.</p>
          </div>
        )}

        {data && data.posts.length > 0 && (
          <>
            <ul className="post-list">
              {data.posts.map((post, i) => (
                <PostRow key={post.id} post={post} index={(page - 1) * PAGE_SIZE + i + 1} />
              ))}
            </ul>

            {data.totalPages > 1 && (
              <div className="pagination">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← novější
                </button>
                <span>
                  {page} / {data.totalPages}
                </span>
                <button disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                  starší →
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
