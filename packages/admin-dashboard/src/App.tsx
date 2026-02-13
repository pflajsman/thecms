import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { MsalProvider } from '@azure/msal-react';
import { PublicClientApplication, EventType } from '@azure/msal-browser';
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
import { ContactFormsList } from './pages/ContactForms/ContactFormsList';
import { ContactFormForm } from './pages/ContactForms/ContactFormForm';
import { SubmissionsList } from './pages/ContactForms/SubmissionsList';
import { msalConfig, isEntraConfigured } from './config/msalConfig';
import { setMsalInstance } from './lib/api';

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
      main: '#000000',
    },
    secondary: {
      main: '#555555',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#000000',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          backgroundColor: '#000000',
          '&:hover': {
            backgroundColor: '#333333',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.12)',
        },
      },
    },
  },
});

// Initialize MSAL instance only when Entra is configured
let msalInstance: PublicClientApplication | undefined;
if (isEntraConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig);

  // Set the active account after login
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: any };
      msalInstance!.setActiveAccount(payload.account);
    }
  });

  // Share MSAL instance with the API client
  setMsalInstance(msalInstance);
}

function AppContent() {
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
                <Route path="contact-forms" element={<ContactFormsList />} />
                <Route path="contact-forms/new" element={<ContactFormForm />} />
                <Route path="contact-forms/:id/edit" element={<ContactFormForm />} />
                <Route path="contact-forms/:formId/submissions" element={<SubmissionsList />} />
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

function App() {
  if (isEntraConfigured() && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <AppContent />
      </MsalProvider>
    );
  }
  return <AppContent />;
}

export default App;
