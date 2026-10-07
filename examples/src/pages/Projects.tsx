import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useProjects, usePage } from '../hooks/useContent';
import { ProjectCard } from '../components/ProjectCard';
import { Spinner, ErrorState } from '../components/Spinner';
import { tintFor } from '../lib/cms';
import { paths, useLang } from '../i18n';

export function Projects() {
  const { lang, t } = useLang();
  const { data: projects, isLoading, isError } = useProjects();
  const { data: intro, isLoading: introLoading } = usePage('home');
  const [params] = useSearchParams();
  const tag = params.get('tag') ?? '';

  // Tags ordered by how many projects use them, so the common ones come first.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects ?? []) for (const tg of p.tags) counts.set(tg, (counts.get(tg) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
  }, [projects]);

  const shown = (projects ?? []).filter((p) => !tag || p.tags.includes(tag));

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className={`hero-text ${introLoading ? 'is-pending' : ''}`}>
            <h1>{intro?.title || t.home.title}</h1>
            <p className="lead">{intro?.subtitle || t.home.subtitle}</p>
          </div>
          <div className="hero-bench" aria-hidden="true">
            <span className="shape shape-square" />
            <span className="shape shape-circle" />
            <span className="shape shape-triangle" />
            <span className="shape shape-pill" />
          </div>
        </div>
      </section>

      <section className="container projects" aria-labelledby="projects-heading">
        <h2 id="projects-heading" className="visually-hidden">
          {t.nav.projects}
        </h2>

        {tags.length > 1 && (
          <nav className="filter" aria-label={t.projects.filterLabel}>
            <Link to={paths.home(lang)} aria-current={!tag ? 'true' : undefined}>
              {t.projects.all}
            </Link>
            {tags.map((name) => (
              <Link key={name} to={`${paths.home(lang)}?tag=${encodeURIComponent(name)}`} aria-current={tag === name ? 'true' : undefined}>
                {name}
              </Link>
            ))}
          </nav>
        )}

        {isLoading && <Spinner />}
        {isError && <ErrorState message={t.projects.loadError} />}

        {projects && shown.length === 0 && (
          <div className="state">
            <p>{tag ? t.projects.emptyFiltered : t.projects.empty}</p>
            {tag && (
              <Link to={paths.home(lang)} className="btn btn-quiet">
                {t.projects.showAll}
              </Link>
            )}
          </div>
        )}

        {shown.length > 0 && (
          <div className="project-grid">
            {shown.map((project) => (
              <ProjectCard key={project.id} project={project} tint={tintFor(project, projects!.indexOf(project))} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
