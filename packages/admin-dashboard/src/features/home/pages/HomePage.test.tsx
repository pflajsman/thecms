import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import type { DashboardStats } from '@/types'
import * as contentApi from '@/features/content/content-api'
import { makeListItem, page, tripType } from '@/features/content/test-fixtures'
import { sitesService } from '@/services/sites'
import { HomePage } from './HomePage'

const statsState = vi.hoisted(() => ({ value: null as unknown as DashboardStats }))
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: statsState.value, isPending: false }),
  useUnreadCount: () => statsState.value.submissions.unread,
}))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Pavel Flajsman', email: 'p@x' } }) }))
vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listEntries: vi.fn(), listContentTypes: vi.fn() }
})
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const base: DashboardStats = {
  entries: { total: 0, draft: 0, published: 0, archived: 0, byType: {} },
  contentTypes: 0,
  media: 0,
  sites: 0,
  submissions: { unread: 0 },
}

const routes = [{ path: '/', element: <HomePage /> }]

beforeEach(() => {
  localStorage.clear()
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(contentApi.listEntries).mockResolvedValue(page([makeListItem({ title: 'Krkonoše 2026' })]))
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
})

describe('HomePage', () => {
  it('guides a new install through setup', async () => {
    statsState.value = base
    renderRoutes(routes)
    expect(await screen.findByRole('heading', { name: 'Welcome to TheCMS' })).toBeInTheDocument()
    const steps = screen.getByRole('list', { name: 'Setup steps' })
    expect(within(steps).getByRole('link', { name: 'Create a model' })).toHaveAttribute('href', '/content-types/new')
    expect(within(steps).getByText('Sign in')).toBeInTheDocument()
  })

  it('shows a working API snippet once a site exists', async () => {
    statsState.value = { ...base, contentTypes: 1, sites: 1 }
    vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [{ id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_secret_123', isActive: true, requestCount: 0, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
    renderRoutes(routes)
    const code = await screen.findByLabelText('Fetch example')
    expect(code).toHaveTextContent('/api/v1/public/content/trip')
    expect(code).toHaveTextContent('cms_secret_123')
  })

  it('can dismiss the checklist', async () => {
    statsState.value = base
    renderRoutes(routes)
    await userEvent.click(await screen.findByRole('button', { name: 'Hide setup guide' }))
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Pavel/ })).toBeInTheDocument()
  })

  it('shows the work queue for an active install', async () => {
    statsState.value = { ...base, contentTypes: 1, sites: 1, media: 61, entries: { total: 23, draft: 4, published: 18, archived: 1, byType: {} }, submissions: { unread: 3 } }
    renderRoutes(routes)
    expect(await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Pavel/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /3\s*unread messages/i })).toHaveAttribute('href', '/inbox')
    expect(await screen.findByRole('link', { name: 'Krkonoše 2026' })).toHaveAttribute('href', '/content/e1')
    expect(screen.getByRole('link', { name: '+ Trip' })).toHaveAttribute('href', `/content/new?type=${tripType.id}`)
    expect(contentApi.listEntries).toHaveBeenCalledWith(expect.objectContaining({ status: 'DRAFT', sortBy: 'updatedAt', limit: 5 }))
  })
})
