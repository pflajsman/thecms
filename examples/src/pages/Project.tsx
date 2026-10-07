import { Link, useParams } from 'react-router-dom';
import { useProject, useProjects } from '../hooks/useContent';
import { MediaImage } from '../components/MediaImage';
import { RichText } from '../components/RichText';
import { Spinner, ErrorState } from '../components/Spinner';
import { ApiError, tintFor } from '../lib/cms';
import { paths, useLang } from '../i18n';

export function Project() {
  const { lang, t } = useLang();
  const { id } = useParams();
  const { data: project, isLoading, error } = useProject(id);
  // The list is usually cached already; it gives the project the same tint as its card.
  const { data: projects } = useProjects();

  if (isLoading) return <Spinner />;
  if (error || !project) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <section className="container page">
        <ErrorState message={missing || !error ? t.project.notFound : t.projects.loadError} />
        <p className="state">
          <Link to={paths.home(lang)} className="btn btn-quiet">
            {t.project.back}
          </Link>
        </p>
      </section>
    );
  }

  const index = projects?.findIndex((p) => p.id === project.id) ?? -1;
  const tint = tintFor(project, Math.max(index, 0));
  const hasFacts = project.year || project.role || project.tags.length > 0 || project.liveUrl || project.repoUrl;

  return (
    <article className="container page project">
      <Link to={paths.home(lang)} className="back-link">
        {t.project.back}
      </Link>

      <header className={`project-head tint-${tint}`}>
        <div>
          <h1>{project.title}</h1>
          {project.summary && <p className="lead">{project.summary}</p>}
        </div>
        {hasFacts && (
          <dl className="facts">
            {project.year && (
              <div>
                <dt>{t.project.year}</dt>
                <dd>{project.year}</dd>
              </div>
            )}
            {project.role && (
              <div>
                <dt>{t.project.role}</dt>
                <dd>{project.role}</dd>
              </div>
            )}
            {project.tags.length > 0 && (
              <div>
                <dt>{t.project.stack}</dt>
                <dd>{project.tags.join(', ')}</dd>
              </div>
            )}
            {(project.liveUrl || project.repoUrl) && (
              <div>
                <dt>{t.project.links}</dt>
                <dd className="fact-links">
                  {project.liveUrl && (
                    <a href={project.liveUrl} target="_blank" rel="noreferrer" className="btn">
                      {t.project.live}
                    </a>
                  )}
                  {project.repoUrl && (
                    <a href={project.repoUrl} target="_blank" rel="noreferrer" className="btn btn-quiet">
                      {t.project.repo}
                    </a>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {project.cover && <MediaImage id={project.cover} alt={project.title} className="project-cover" eager />}

      {project.body && (
        <div className="project-body">
          <RichText html={project.body} />
        </div>
      )}

      {project.gallery.length > 0 && (
        <section className="gallery" aria-label={t.project.gallery}>
          {project.gallery.map((mediaId, i) => (
            <MediaImage key={mediaId} id={mediaId} alt={`${project.title}, ${i + 1}`} />
          ))}
        </section>
      )}
    </article>
  );
}
