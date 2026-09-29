import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import { setViewport } from '@/test/viewport'
import apiClient from '@/lib/api'
import type { InboxItem } from '../inbox-api'
import { InboxPage } from './InboxPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const form = { id: 'f1', name: 'Contact', slug: 'contact', fields: [{ name: 'email', label: 'Email', type: 'EMAIL' as const }, { name: 'message', label: 'Message', type: 'TEXTAREA' as const }] }
const items: InboxItem[] = [
  { id: 's1', formId: 'f1', data: { email: 'jana@x.test', message: 'Dotaz k trase' }, status: 'UNREAD', emailSent: false, emailError: 'SMTP down', createdAt: '2026-09-29T10:00:00Z', updatedAt: '', form },
  { id: 's2', formId: 'f1', data: { message: 'No email here' }, status: 'READ', emailSent: true, createdAt: '2026-09-28T10:00:00Z', updatedAt: '', form },
]

const routes = [
  { path: '/inbox', element: <InboxPage /> },
  { path: '/inbox/:submissionId', element: <InboxPage /> },
]

beforeEach(() => {
  setViewport(true)
  vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === '/submissions') {
      const status = config?.params?.status
      const data = status ? items.filter((i) => i.status === status) : items
      return { data: { success: true, data, pagination: { page: 1, limit: 30, total: data.length, totalPages: 1 } } }
    }
    return { data: { success: true, data: [] } }
  })
  vi.mocked(apiClient.patch).mockResolvedValue({ data: { success: true } })
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } })
})

describe('InboxPage', () => {
  it('shows unread messages by default and opens one, marking it read once', async () => {
    const { router } = renderRoutes(routes, { route: '/inbox' })
    const list = await screen.findByRole('list', { name: 'Messages' })
    expect(within(list).getAllByRole('link')).toHaveLength(1)
    await userEvent.click(within(list).getByRole('link', { name: /jana@x\.test/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/inbox/s1'))
    const message = screen.getByRole('article', { name: /jana@x\.test/ })
    expect(within(message).getByText('Dotaz k trase')).toBeInTheDocument()
    expect(within(message).getByText(/Notification email failed: SMTP down/)).toBeInTheDocument()
    expect(within(message).getByRole('link', { name: 'Reply' })).toHaveAttribute('href', expect.stringContaining('mailto:jana@x.test'))
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledTimes(1))
    expect(apiClient.patch).toHaveBeenCalledWith('/contact-forms/f1/submissions/s1', { status: 'READ' })
  })

  it('offers no Reply link without an email and archives', async () => {
    renderRoutes(routes, { route: '/inbox/s2?view=all' })
    const message = await screen.findByRole('article', { name: /Anonymous/ })
    expect(within(message).queryByRole('link', { name: 'Reply' })).not.toBeInTheDocument()
    await userEvent.click(within(message).getByRole('button', { name: 'Archive' }))
    expect(apiClient.patch).toHaveBeenCalledWith('/contact-forms/f1/submissions/s2', { status: 'ARCHIVED' })
    expect(apiClient.patch).not.toHaveBeenCalledWith(expect.anything(), { status: 'READ' })
  })

  it('confirms before deleting', async () => {
    renderRoutes(routes, { route: '/inbox/s2?view=all' })
    const message = await screen.findByRole('article', { name: /Anonymous/ })
    await userEvent.click(within(message).getByRole('button', { name: 'Delete' }))
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(apiClient.delete).toHaveBeenCalledWith('/contact-forms/f1/submissions/s2')
  })

  it('shows a caught-up state when nothing is unread', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [], pagination: { page: 1, limit: 30, total: 0, totalPages: 1 } } })
    renderRoutes(routes, { route: '/inbox' })
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument()
  })

  it('on small screens shows the list or the message, not both', async () => {
    setViewport(false)
    renderRoutes(routes, { route: '/inbox/s1' })
    expect(await screen.findByRole('article', { name: /jana@x\.test/ })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Messages' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to messages' })).toHaveAttribute('href', '/inbox')
  })
})
