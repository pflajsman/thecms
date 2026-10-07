import { Link } from 'react-router-dom';
import type { Project, Tint } from '../types';
import { paths, useLang } from '../i18n';
import { MediaImage } from './MediaImage';

export function ProjectCard({ project, tint }: { project: Project; tint: Tint }) {
  const { lang } = useLang();
  return (
    <article className="project-card">
      <Link to={paths.project(lang, project.id)} className={`plate tint-${tint}`}>
        {project.cover ? (
          <MediaImage id={project.cover} alt="" className="card-cover" />
        ) : (
          <span className="plate-initial" aria-hidden="true">
            {project.title.charAt(0)}
          </span>
        )}
      </Link>
      <div className="card-text">
        <h2>
          <Link to={paths.project(lang, project.id)}>{project.title}</Link>
        </h2>
        {project.year && <span className="card-year">{project.year}</span>}
      </div>
      {project.summary && <p className="card-summary">{project.summary}</p>}
      {project.tags.length > 0 && (
        <ul className="tags">
          {project.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
