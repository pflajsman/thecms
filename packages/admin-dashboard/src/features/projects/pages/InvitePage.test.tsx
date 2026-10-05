import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { InviteRoute } from './InvitePage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, isLoading: false, login: vi.fn() } }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth.value }))

const ok = (data: unknown) => ({ data: { success: true, data } })
const gone = () => new AxiosError('gone', '410', undefined, undefined, { status: 410, data: {}, statusText: 'Gone', headers: {}, config: { headers: new AxiosHeaders() } })
const routes = [
  { path: '/invite/:token', element: <InviteRoute /> },
  { path: '/', element: <p>home</p> },
]

beforeEach(() => {
  auth.value = { ...auth.value, isAuthenticated: true }
  localStorage.removeItem('current_project')
  vi.mocked(apiClient.get).mockImplementation(async () => ok({ projectName: 'Client shop', role: 'OWNER', invitedByName: 'Pavel' }))
  vi.mocked(apiClient.post).mockImplementation(async () => ok({ projectId: 'p2' }))
})

it('accepts the invitation and opens the project', async () => {
  const { container, router } = renderRoutes(routes, { route: '/invite/abc' })
  expect(await screen.findByText('Pavel invited you to Client shop as Owner.')).toBeInTheDocument()
  await expectNoA11yViolations(container)
  await userEvent.click(screen.getByRole('button', { name: 'Accept invitation' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  expect(apiClient.post).toHaveBeenCalledWith('/invites/abc/accept')
  expect(localStorage.getItem('current_project')).toBe('p2')
})

it('explains a used or expired invitation', async () => {
  vi.mocked(apiClient.get).mockRejectedValue(gone())
  renderRoutes(routes, { route: '/invite/abc' })
  expect(await screen.findByRole('heading', { name: 'This invitation is no longer valid' })).toBeInTheDocument()
})

it('asks to sign in first', async () => {
  auth.value = { ...auth.value, isAuthenticated: false }
  renderRoutes(routes, { route: '/invite/abc' })
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(auth.value.login).toHaveBeenCalled()
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/invite/abc' })
  expect(await screen.findByText('Pavel vás pozval(a) do projektu Client shop s rolí Vlastník.')).toBeInTheDocument()
})
