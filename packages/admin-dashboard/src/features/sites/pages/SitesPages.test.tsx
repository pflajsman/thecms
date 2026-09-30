import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { sitesService, type Site } from '@/services/sites'
import * as contentApi from '@/features/content/content-api'
import { tripType } from '@/features/content/test-fixtures'
import { SitesListPage } from './SitesListPage'
import { SiteFormPage } from './SiteFormPage'
import { AxiosError } from 'axios'

vi.mock('@/services/sites', () => ({
  sitesService: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), rotateApiKey: vi.fn() },
}))
vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listContentTypes: vi.fn() }
})

const site: Site = {
  id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_secretkey123456WXYZ', description: '', allowedOrigins: ['https://blog.test'],
  isActive: true, requestCount: 42, lastRequestAt: '2026-09-29T10:00:00Z', createdAt: '', updatedAt: '',
}

const routes = [
  { path: '/sites', element: <SitesListPage /> },
  { path: '/sites/:id', element: <SiteFormPage /> },
]

beforeEach(() => {
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [site], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(sitesService.getById).mockResolvedValue({ success: true, data: site })
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
})

describe('SitesListPage', () => {
  it('masks the key and reveals it on request', async () => {
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    expect(within(card).getByText('cms_••••••••WXYZ')).toBeInTheDocument()
    expect(within(card).getByText(/42 requests/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Reveal API key' }))
    expect(within(card).getByText('cms_secretkey123456WXYZ')).toBeInTheDocument()
  })

  it('rotates only after the exact site name is typed', async () => {
    vi.mocked(sitesService.rotateApiKey).mockResolvedValue({ success: true, data: { ...site, apiKey: 'cms_newkey000000ABCD' } })
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    await userEvent.click(within(card).getByRole('button', { name: 'Rotate key' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('stops working immediately')
    const confirm = within(dialog).getByRole('button', { name: 'Rotate key' })
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'blog')
    expect(confirm).toBeDisabled()
    await userEvent.clear(within(dialog).getByLabelText(/type/i))
    await userEvent.type(within(dialog).getByLabelText(/type/i), 'Blog')
    await userEvent.click(confirm)
    expect(sitesService.rotateApiKey).toHaveBeenCalledWith('s1')
  })
})

describe('SiteFormPage', () => {
  it('adds allowed origins as chips and rejects invalid ones', async () => {
    vi.mocked(sitesService.update).mockResolvedValue({ success: true, data: site })
    renderRoutes(routes, { route: '/sites/s1' })
    const input = await screen.findByLabelText('Add allowed origin')
    await userEvent.type(input, 'blog.test{Enter}')
    expect(screen.getByText('Enter a full URL, for example https://example.com')).toBeInTheDocument()
    await userEvent.clear(input)
    await userEvent.type(input, 'http://localhost:5174{Enter}')
    expect(screen.getByRole('button', { name: 'Remove http://localhost:5174' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save site' }))
    expect(sitesService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ allowedOrigins: ['https://blog.test', 'http://localhost:5174'] }))
  })

  it('shows connect snippets with the real key and first model', async () => {
    renderRoutes(routes, { route: '/sites/s1' })
    const js = await screen.findByLabelText('JavaScript example')
    await waitFor(() => expect(js).toHaveTextContent('/api/v1/public/content/trip'))
    expect(js).toHaveTextContent('cms_secretkey123456WXYZ')
    expect(screen.getByLabelText('curl example')).toHaveTextContent("curl -H 'X-API-Key: cms_secretkey123456WXYZ'")
  })

  it('creates a new site and opens it', async () => {
    vi.mocked(sitesService.create).mockResolvedValue({ success: true, data: { ...site, id: 's9' } })
    const { router } = renderRoutes(routes, { route: '/sites/new' })
    await userEvent.type(await screen.findByLabelText('Name'), 'Shop')
    await userEvent.type(screen.getByLabelText('Domain'), 'shop.test')
    await userEvent.click(screen.getByRole('button', { name: 'Save site' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/sites/s9'))
  })

  it('offers the Active switch only for existing sites (new sites are always created active)', async () => {
    renderRoutes(routes, { route: '/sites/new' })
    await screen.findByLabelText('Name')
    expect(screen.queryByRole('switch', { name: 'Active' })).not.toBeInTheDocument()
  })

  it('adds an origin still typed in the box when saving', async () => {
    vi.mocked(sitesService.update).mockResolvedValue({ success: true, data: site })
    renderRoutes(routes, { route: '/sites/s1' })
    await userEvent.type(await screen.findByLabelText('Add allowed origin'), 'https://shop.example.com')
    const save = screen.getByRole('button', { name: 'Save site' })
    expect(save).toBeEnabled()
    await userEvent.click(save)
    expect(sitesService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ allowedOrigins: ['https://blog.test', 'https://shop.example.com'] }))
  })

  it('blocks saving while the origin box holds an invalid value', async () => {
    renderRoutes(routes, { route: '/sites/s1' })
    await userEvent.type(await screen.findByLabelText('Add allowed origin'), 'shop.example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Save site' }))
    expect(screen.getByText('Enter a full URL, for example https://example.com')).toBeInTheDocument()
    expect(sitesService.update).not.toHaveBeenCalled()
  })
})

describe('in Czech', () => {
  it('shows the card with Czech counts and guards rotation in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/sites' })
    const card = await screen.findByRole('article', { name: 'Blog' })
    expect(within(card).getByText(/42 požadavků/)).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'Vyměnit klíč' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent('přestane okamžitě fungovat')
  })

  it('keeps a server validation message as sent', async () => {
    await setTestLanguage('cs')
    const error = new AxiosError('x', '400', undefined, undefined, { status: 400, data: { error: 'Validation failed', details: [{ message: 'Invalid url' }] } } as never)
    vi.mocked(sitesService.update).mockRejectedValue(error)
    renderRoutes(routes, { route: '/sites/s1' })
    await userEvent.type(await screen.findByLabelText('Přidat povolený původ'), 'https://x.test{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Uložit web' }))
    expect(await screen.findByText('Validation failed: Invalid url')).toBeInTheDocument()
  })
})

it('re-translates a visible origin error when the language changes', async () => {
  renderRoutes(routes, { route: '/sites/s1' })
  await userEvent.type(await screen.findByLabelText('Add allowed origin'), 'blog.test{Enter}')
  expect(screen.getByText('Enter a full URL, for example https://example.com')).toBeInTheDocument()
  await setTestLanguage('cs')
  expect(screen.getByText('Zadejte celou adresu URL, například https://example.com')).toBeInTheDocument()
})
