import type { ReactElement, ReactNode } from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter, createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@/app/theme/ThemeProvider'
import { Toaster } from '@/components/ui/sonner'
import { i18n } from '@/i18n'
import { LanguageProvider } from '@/i18n/LanguageProvider'
import type { Language } from '@/i18n/language'

interface Options {
  route?: string
}

export function renderWithProviders(ui: ReactElement, { route = '/' }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <LanguageProvider>
            <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    )
  }
  return render(ui, { wrapper: Wrapper })
}

export function renderRoutes(routes: RouteObject[], { route = '/' }: Options = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(routes, { initialEntries: [route] })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <RouterProvider router={router} />
          <Toaster />
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  )
  return { ...result, router, queryClient }
}

/** Switch the UI language inside a test (the setup file resets to English after each test). */
export async function setTestLanguage(language: Language) {
  await act(async () => {
    await i18n.changeLanguage(language)
  })
}
