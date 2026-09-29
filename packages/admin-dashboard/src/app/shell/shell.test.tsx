import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Boxes, FileText, House, Image as ImageIcon, Inbox, Plus } from 'lucide-react'
import { renderWithProviders } from '@/test/render'
import type { AppModule, CreateAction } from '@/modules/types'
import { Sidebar } from './Sidebar'
import { MobileTabs } from './MobileTabs'
import { CommandPaletteProvider } from './CommandPalette'
import { AppShell } from './AppShell'

const auth = vi.hoisted(() => ({
  value: {
    user: { name: 'Pavel Flajsman', email: 'pavel@example.com' } as { name: string; email: string } | null,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  },
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }))

const testModules: AppModule[] = [
  { id: 'home', label: 'Home', icon: House, group: 'workspace', path: '/', mobileTab: true, routes: [] },
  { id: 'content', label: 'Content', icon: FileText, group: 'workspace', path: '/content', matches: ['/entries'], mobileTab: true, routes: [] },
  { id: 'media', label: 'Media', icon: ImageIcon, group: 'workspace', path: '/media', mobileTab: true, routes: [] },
  { id: 'inbox', label: 'Inbox', icon: Inbox, group: 'workspace', path: '/inbox', mobileTab: true, useBadge: () => 3, routes: [] },
  { id: 'models', label: 'Content models', icon: Boxes, group: 'setup', path: '/models', matches: ['/content-types'], routes: [] },
]
const testActions: CreateAction[] = [{ id: 'new-entry', label: 'New entry', to: '/content', icon: Plus }]

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function withPalette(ui: React.ReactElement) {
  return (
    <CommandPaletteProvider modules={testModules} actions={testActions}>
      {ui}
      <Routes><Route path="*" element={<LocationProbe />} /></Routes>
    </CommandPaletteProvider>
  )
}

beforeEach(() => {
  auth.value = { ...auth.value, isAuthenticated: true, isLoading: false }
})

describe('Sidebar', () => {
  it('renders Workspace and Setup groups', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />))
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(within(nav).getByText('Workspace')).toBeInTheDocument()
    expect(within(nav).getByText('Setup')).toBeInTheDocument()
  })

  it('marks Content models active on a legacy /content-types URL, not Content', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />), { route: '/content-types/new' })
    expect(screen.getByRole('link', { name: /Content models/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /^Content$/ })).not.toHaveAttribute('aria-current')
  })

  it('shows the unread badge', () => {
    renderWithProviders(withPalette(<Sidebar modules={testModules} />))
    expect(screen.getByRole('link', { name: /Inbox/ })).toHaveTextContent('3')
  })
})

describe('MobileTabs', () => {
  it('renders the four tabs and a create button', () => {
    renderWithProviders(withPalette(<MobileTabs modules={testModules} actions={testActions} />), { route: '/media' })
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(nav).getAllByRole('link')).toHaveLength(4)
    expect(within(nav).getByRole('link', { name: /Media/ })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('button', { name: 'Create' })).toBeInTheDocument()
  })
})

describe('Command palette', () => {
  it('opens with Ctrl+K and navigates to a module', async () => {
    const user = userEvent.setup()
    renderWithProviders(withPalette(<div />))
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByPlaceholderText('Search or jump to…')
    await user.type(input, 'Content models')
    await user.keyboard('{Enter}')
    expect(screen.getByTestId('location')).toHaveTextContent('/models')
  })
})

describe('AppShell', () => {
  it('shows a skeleton while auth is loading', () => {
    auth.value = { ...auth.value, isLoading: true }
    renderWithProviders(<AppShell />)
    expect(screen.getByLabelText('Loading TheCMS')).toHaveAttribute('aria-busy', 'true')
  })

  it('shows the sign-in screen when signed out', async () => {
    auth.value = { ...auth.value, isAuthenticated: false }
    renderWithProviders(<AppShell />)
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(auth.value.login).toHaveBeenCalled()
  })
})
