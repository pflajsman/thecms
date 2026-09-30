import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { WebhooksListPage } from './WebhooksListPage'
import { WebhookFormPage } from './WebhookFormPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const hook = {
  id: 'w1', name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published', 'entry.unpublished'], isActive: true,
  secretPreview: 'whsec_ab...', totalDeliveries: 3, successfulDeliveries: 2, failedDeliveries: 1,
  lastDeliveryAt: '2026-09-29T10:00:00Z', lastDeliveryStatus: 'FAILED', createdAt: '', updatedAt: '',
}
const logs = [
  { timestamp: '2026-09-29T10:00:00Z', event: 'entry.published', status: 'FAILED', statusCode: 500, responseTime: 120, errorMessage: 'Internal error', attemptNumber: 1, payload: { hello: 'world' } },
]

const routes = [
  { path: '/webhooks', element: <WebhooksListPage /> },
  { path: '/webhooks/:id', element: <WebhookFormPage /> },
]

beforeEach(() => {
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 1 } })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/webhooks') return { data: { success: true, data: [hook], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } } }
    if (url === '/webhooks/w1') return { data: { success: true, data: hook } }
    if (url === '/webhooks/w1/logs') return { data: { success: true, data: logs } }
    return { data: { success: true, data: [] } }
  })
})

it('lists webhooks with their last delivery', async () => {
  renderRoutes(routes, { route: '/webhooks' })
  const row = await screen.findByRole('link', { name: /Deploy/ })
  expect(row).toHaveAttribute('href', '/webhooks/w1')
  expect(screen.getByText(/2 events/)).toBeInTheDocument()
  expect(screen.getByText('Last delivery failed')).toBeInTheDocument()
})

it('creates a webhook and shows its secret once', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...hook, id: 'w9', secret: 'whsec_full_secret_value' } } })
  const { router } = renderRoutes(routes, { route: '/webhooks/new' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Deploy')
  await userEvent.type(screen.getByLabelText('Endpoint URL'), 'https://example.com/hook')
  await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
  expect(await screen.findByText('Choose at least one event')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Entry published' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
  const dialog = await screen.findByRole('dialog', { name: 'Signing secret' })
  expect(dialog).toHaveTextContent('whsec_full_secret_value')
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks', expect.objectContaining({ events: ['entry.published'] }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/webhooks/w9'))
})

it('sends a test and shows the delivery log', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { success: true, statusCode: 200, responseTime: 85 } } })
  renderRoutes(routes, { route: '/webhooks/w1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Send test' }))
  expect(await screen.findByText('Test delivered: 200 in 85 ms')).toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks/w1/test')
  const log = screen.getByRole('table', { name: 'Delivery log' })
  expect(within(log).getByText('Entry published')).toBeInTheDocument()
  expect(within(log).getByText('500')).toBeInTheDocument()
})

it('rotates the secret after confirming and shows the new one', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { newSecret: 'whsec_rotated' } } })
  renderRoutes(routes, { route: '/webhooks/w1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Rotate secret' }))
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Rotate secret' }))
  expect(await screen.findByRole('dialog', { name: 'Signing secret' })).toHaveTextContent('whsec_rotated')
  expect(apiClient.post).toHaveBeenCalledWith('/webhooks/w1/rotate-secret')
})

describe('webhook scoped to a site', () => {
  const blog = { id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_key', isActive: true, requestCount: 0, createdAt: '', updatedAt: '' }
  // The backend populates siteId on GET.
  const scoped = { ...hook, id: 'w2', siteId: { id: 's1', name: 'Blog', domain: 'blog.test' } }

  beforeEach(() => {
    vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [blog], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/webhooks/w2') return { data: { success: true, data: scoped } }
      return { data: { success: true, data: [] } }
    })
    vi.mocked(apiClient.put).mockImplementation(async (_url: string, body: unknown) => ({ data: { success: true, data: { ...scoped, ...(body as object) } } }))
  })

  it('shows the site and saves edits with its id', async () => {
    renderRoutes(routes, { route: '/webhooks/w2' })
    const site = await screen.findByRole('combobox', { name: 'Site' })
    await waitFor(() => expect(site).toHaveTextContent('Blog'))
    await userEvent.type(screen.getByLabelText('Name'), ' v2')
    await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/webhooks/w2', expect.objectContaining({ name: 'Deploy v2', siteId: 's1' })))
  })

  it('clears the site when All sites is chosen', async () => {
    renderRoutes(routes, { route: '/webhooks/w2' })
    const site = await screen.findByRole('combobox', { name: 'Site' })
    await waitFor(() => expect(site).toHaveTextContent('Blog'))
    await userEvent.click(site)
    await userEvent.click(await screen.findByRole('option', { name: 'All sites' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save webhook' }))
    await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/webhooks/w2', expect.objectContaining({ siteId: null })))
  })
})

describe('in Czech', () => {
  it('lists webhooks with Czech counts', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/webhooks' })
    expect(await screen.findByText(/2 události/)).toBeInTheDocument()
    expect(screen.getByText('Poslední doručení selhalo')).toBeInTheDocument()
  })

  it('reports a test delivery and shows the log in Czech', async () => {
    await setTestLanguage('cs')
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { success: true, statusCode: 200, responseTime: 85 } } })
    renderRoutes(routes, { route: '/webhooks/w1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Odeslat test' }))
    expect(await screen.findByText('Test doručen: 200 za 85 ms')).toBeInTheDocument()
    const log = screen.getByRole('table', { name: 'Záznam doručení' })
    expect(within(log).getByText('Selhalo')).toBeInTheDocument()
    expect(within(log).getByText('Položka publikována')).toBeInTheDocument()
  })

  it('shows event checkboxes in Czech after switching language', async () => {
    renderRoutes(routes, { route: '/webhooks/new' })
    await screen.findByRole('checkbox', { name: 'Entry published' })
    await setTestLanguage('cs')
    expect(screen.getByRole('checkbox', { name: 'Položka publikována' })).toBeInTheDocument()
  })
})
