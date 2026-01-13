import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { ContentTypesList } from './pages/ContentTypes/ContentTypesList';
import { ContentTypeForm } from './pages/ContentTypes/ContentTypeForm';
import { ContentEntriesList } from './pages/ContentEntries/ContentEntriesList';
import { ContentEntryForm } from './pages/ContentEntries/ContentEntryForm';
import { MediaLibrary } from './pages/Media/MediaLibrary';
import { SitesList } from './pages/Sites/SitesList';
import { SiteForm } from './pages/Sites/SiteForm';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="content-types" element={<ContentTypesList />} />
                <Route path="content-types/new" element={<ContentTypeForm />} />
                <Route path="content-types/:id/edit" element={<ContentTypeForm />} />
                <Route path="entries" element={<ContentEntriesList />} />
                <Route path="entries/new" element={<ContentEntryForm />} />
                <Route path="entries/:id/edit" element={<ContentEntryForm />} />
                <Route path="media" element={<MediaLibrary />} />
                <Route path="sites" element={<SitesList />} />
                <Route path="sites/new" element={<SiteForm />} />
                <Route path="sites/:id/edit" element={<SiteForm />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
