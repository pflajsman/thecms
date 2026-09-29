import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
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
