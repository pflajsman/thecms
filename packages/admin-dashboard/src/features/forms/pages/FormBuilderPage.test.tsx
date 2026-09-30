import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { setViewport } from '@/test/viewport'
import type { ContactForm } from '@/types'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { FormBuilderPage } from './FormBuilderPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn() } }))

const form: ContactForm = {
  id: 'f1', name: 'Contact us', slug: 'contact-us', recipientEmail: 'me@x.test', isActive: true, submissionCount: 5, createdAt: '', updatedAt: '',
  fields: [
    { name: 'email', label: 'Email', type: 'EMAIL', required: true },
    { name: 'message', label: 'Message', type: 'TEXTAREA', required: true, placeholder: 'How can we help?' },
  ],
}

const routes = [
  { path: '/forms/:id', element: <FormBuilderPage /> },
  { path: '/forms', element: <p>forms list</p> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [{ id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_key', isActive: true, requestCount: 0, createdAt: '', updatedAt: '' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => ({ data: { success: true, data: url === '/contact-forms/f1' ? form : [] } }))
})

it('previews the form live and shows an embed snippet', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  const preview = await screen.findByRole('region', { name: 'Preview' })
  expect(within(preview).getByLabelText(/Message/)).toHaveAttribute('placeholder', 'How can we help?')
  await userEvent.click(screen.getByRole('button', { name: /^Message/ }))
  const label = within(screen.getByRole('complementary', { name: 'Field settings' })).getByLabelText('Label')
  await userEvent.clear(label)
  await userEvent.type(label, 'Your question')
  expect(within(preview).getByLabelText(/Your question/)).toBeInTheDocument()
  const snippet = screen.getByLabelText('Submit example')
  expect(snippet).toHaveTextContent('/api/v1/public/forms/contact-us/submit')
  expect(snippet).toHaveTextContent('cms_key')
})

it('creates a new form with defaults', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...form, id: 'f9' } } })
  const { router } = renderRoutes(routes, { route: '/forms/new' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Contact us')
  await userEvent.type(screen.getByLabelText('Send submissions to'), 'me@x.test')
  await userEvent.click(screen.getByRole('button', { name: 'Save form' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/forms/f9'))
  expect(apiClient.post).toHaveBeenCalledWith('/contact-forms', expect.objectContaining({ slug: 'contact-us', recipientEmail: 'me@x.test' }))
})

it('warns that deleting removes the submissions', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete form' }))
  expect(await screen.findByRole('alertdialog')).toHaveTextContent('5 submissions')
})

it('keeps the key of a field once the form is saved', async () => {
  vi.mocked(apiClient.put).mockImplementation(async (_url: string, body?: unknown) => ({ data: { success: true, data: { ...form, ...(body as object) } } }))
  renderRoutes(routes, { route: '/forms/f1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add Short text field' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save form' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled())
  await userEvent.click(await screen.findByRole('button', { name: /^Short text/ }))
  const inspector = screen.getByRole('complementary', { name: 'Field settings' })
  const label = within(inspector).getByLabelText('Label')
  await userEvent.clear(label)
  await userEvent.type(label, 'Phone')
  expect(within(inspector).getByLabelText('API key')).toHaveValue('shortText')
})

it('marks required preview fields for assistive technology', async () => {
  renderRoutes(routes, { route: '/forms/f1' })
  const preview = await screen.findByRole('region', { name: 'Preview' })
  expect(within(preview).getByLabelText(/Email/)).toBeRequired()
  expect(within(preview).getByLabelText(/Message/)).toBeRequired()
})

describe('in Czech', () => {
  it('starts a new form with Czech default labels and English keys', async () => {
    await setTestLanguage('cs')
    vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { ...form, id: 'f9' } } })
    renderRoutes(routes, { route: '/forms/new' })
    await userEvent.type(await screen.findByLabelText('Název'), 'Kontakt')
    await userEvent.type(screen.getByLabelText('Odesílat odpovědi na'), 'me@x.test')
    const preview = screen.getByRole('region', { name: 'Náhled' })
    expect(within(preview).getByLabelText(/Jméno/)).toBeInTheDocument()
    expect(within(preview).getByLabelText(/E-mail/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Uložit formulář' }))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled())
    const body = vi.mocked(apiClient.post).mock.calls[0][1] as { fields: { name: string; label: string }[] }
    expect(body.fields.map((f) => f.name)).toEqual(['name', 'email', 'message'])
    expect(body.fields.map((f) => f.label)).toEqual(['Jméno', 'E-mail', 'Zpráva'])
  })

  it('shows the embed panel in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: '/forms/f1' })
    expect(await screen.findByRole('heading', { name: 'Vložení na web' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ukázka odeslání')).toHaveTextContent('/forms/contact-us/submit')
  })
})
