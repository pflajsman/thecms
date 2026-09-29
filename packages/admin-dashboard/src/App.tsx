import { BrowserRouter, Navigate, useRoutes, type RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType } from '@azure/msal-browser'
import { AuthProvider } from './contexts/AuthContext'
import { msalConfig, isEntraConfigured } from './config/msalConfig'
import { setMsalInstance } from './lib/api'
import { ThemeProvider } from './app/theme/ThemeProvider'
import { LegacyMuiTheme } from './app/theme/LegacyMuiTheme'
import { AppShell } from './app/shell/AppShell'
import { Toaster } from './components/ui/sonner'
import { collectRoutes } from './modules/nav'
import { modules } from './modules/registry'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Initialize MSAL instance only when Entra is configured
let msalInstance: PublicClientApplication | undefined
if (isEntraConfigured()) {
  msalInstance = new PublicClientApplication(msalConfig)

  // Set the active account after login
  msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
      const payload = event.payload as { account: any }
      msalInstance!.setActiveAccount(payload.account)
    }
  })

  // Share MSAL instance with the API client
  setMsalInstance(msalInstance)
}

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
  },
]

function AppRoutes() {
  return useRoutes(routes)
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LegacyMuiTheme>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
            <Toaster position="bottom-right" />
          </AuthProvider>
        </LegacyMuiTheme>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

function App() {
  if (isEntraConfigured() && msalInstance) {
    return (
      <MsalProvider instance={msalInstance}>
        <AppContent />
      </MsalProvider>
    )
  }
  return <AppContent />
}

export default App
