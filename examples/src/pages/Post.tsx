import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePost } from '../hooks/usePosts';
import { RichText } from '../components/RichText';
import { Spinner, ErrorState } from '../components/Spinner';
import { formatDate } from '../lib/format';
import { config } from '../config';

export function Post() {
  const { id } = useParams();
  const { data: post, isLoading, isError, error } = usePost(id);

  useEffect(() => {
    if (post) document.title = `${post.title} — ${config.siteTitle}`;
    return () => {
      document.title = config.siteTitle;
    };
  }, [post]);

  if (isLoading) return <Spinner />;
  if (isError || !post)
    return (
      <div className="container">
        <ErrorState message={(error as Error)?.message || 'Příspěvek nenalezen.'} />
        <div style={{ textAlign: 'center' }}>
          <Link to="/" className="back">
            ← zpět na výpis
          </Link>
        </div>
      </div>
    );

  return (
    <article className="article">
      <div className="container">
        <Link to="/" className="back">
          ← zpět
        </Link>
        <div className="kicker">
          {formatDate(post.date)}
          {post.author ? ` · ${post.author}` : ''}
        </div>
        <h1>{post.title}</h1>

        {post.tags.length > 0 && (
          <div className="tags" style={{ marginBottom: 8 }}>
            {post.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}

        {post.coverImage && (
          <img className="cover" src={post.coverImage} alt={post.title} />
        )}

        <RichText html={post.body} />
      </div>
    </article>
  );
}
