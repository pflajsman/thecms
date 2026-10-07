import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Setup } from './components/Setup';
import { Projects } from './pages/Projects';
import { Project } from './pages/Project';
import { About } from './pages/About';
import { NotFound } from './pages/NotFound';
import { isConfigured } from './config';
import { paths, preferredLang, sectionSegments } from './i18n';

/** Routes inside /:lang. Each section answers to its Czech and English segment. */
export const routes = (
  <>
    <Route path="/" element={<Navigate to={paths.home(preferredLang())} replace />} />
    <Route path=":lang" element={<Layout />}>
      <Route index element={<Projects />} />
      {sectionSegments('project').map((s) => (
        <Route key={s} path={`${s}/:id`} element={<Project />} />
      ))}
      {sectionSegments('about').map((s) => (
        <Route key={s} path={s} element={<About />} />
      ))}
      <Route path="*" element={<NotFound />} />
    </Route>
  </>
);

export default function App() {
  if (!isConfigured) {
    return <Setup />;
  }

  return (
    <BrowserRouter>
      <Routes>{routes}</Routes>
    </BrowserRouter>
  );
}
