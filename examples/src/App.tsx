import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Setup } from './components/Setup';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { Trips } from './pages/Trips';
import { Trip } from './pages/Trip';
import { About } from './pages/About';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';
import { isConfigured } from './config';

export default function App() {
  if (!isConfigured) {
    return <Setup />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="post/:id" element={<Post />} />
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:id" element={<Trip />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
