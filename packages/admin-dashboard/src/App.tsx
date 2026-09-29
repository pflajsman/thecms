import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MsalProvider } from '@azure/msal-react'
import { PublicClientApplication, EventType, type AuthenticationResult } from '@azure/msal-browser'
import { AuthProvider } from './contexts/AuthContext'
import { msalConfig, isEntraConfigured } from './config/msalConfig'
import { setMsalInstance } from './lib/api'
import { ThemeProvider } from './app/theme/ThemeProvider'
import { Toaster } from './components/ui/sonner'
import { routes } from './app/routes'

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
      const payload = event.payload as AuthenticationResult
      msalInstance!.setActiveAccount(payload.account)
    }
  })

  // Share MSAL instance with the API client
  setMsalInstance(msalInstance)
}

const router = createBrowserRouter(routes)

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" />
        </AuthProvider>
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
