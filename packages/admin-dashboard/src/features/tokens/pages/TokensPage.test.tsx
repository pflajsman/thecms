import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { TokensPage } from './TokensPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

const SECRET = 'tcms_pat_SECRETsecretSECRETsecretSECRETsecret123'
const routes = [
  { path: '/account/tokens', element: <><TokensPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <Link to="/account/tokens">back</Link> },
]
const item = (over: Record<string, unknown> = {}) => ({ id: 't1', name: 'Laptop', prefix: 'tcms_pat_abc', createdAt: '2026-10-02T08:00:00.000Z', expired: false, ...over })

let stored: ReturnType<typeof item>[] = []
beforeEach(() => {
  stored = []
  vi.mocked(apiClient.get).mockImplementation(async () => ({ data: { success: true, data: stored } }))
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => {
    const b = body as { name: string; expiresInDays?: number }
    const created = item({ id: `t${stored.length + 1}`, name: b.name, ...(b.expiresInDays ? { expiresAt: '2026-11-01T08:00:00.000Z' } : {}) })
    stored = [created, ...stored]
    return { data: { success: true, data: { ...created, token: SECRET } } }
  })
  vi.mocked(apiClient.delete).mockImplementation(async (url: string) => {
    stored = stored.filter((t) => `/tokens/${t.id}` !== url)
    return { status: 204 }
  })
})

it('creates a token and shows it once with the Claude Code command', async () => {
  const { container } = renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByText('You have no tokens yet.')).toBeInTheDocument()
  expect(screen.getByText(/never publish, unpublish, archive or delete/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Name'), 'Laptop')
  await userEvent.selectOptions(screen.getByLabelText('Expires'), 'In 30 days')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  const box = await screen.findByRole('region', { name: 'Your new token' })
  expect(apiClient.post).toHaveBeenCalledWith('/tokens', { name: 'Laptop', expiresInDays: 30 })
  expect(within(box).getByLabelText('Token')).toHaveValue(SECRET)
  expect(within(box).getByText(/claude mcp add --transport http thecms .*\/mcp --header "Authorization: Bearer tcms_pat_SECRET/)).toBeInTheDocument()
  expect(within(box).getByText('Copy it now. It will not be shown again.')).toBeInTheDocument()
  expect(await screen.findByText('Laptop')).toBeInTheDocument()
  expect(screen.getByText(/Expires 1 Nov 2026/)).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('copies the token and the command', async () => {
  const user = userEvent.setup()
  renderRoutes(routes, { route: '/account/tokens' })
  await user.type(await screen.findByLabelText('Name'), 'Laptop')
  await user.click(screen.getByRole('button', { name: 'Create token' }))
  const box = await screen.findByRole('region', { name: 'Your new token' })
  await user.click(within(box).getByRole('button', { name: 'Copy Token' }))
  expect(await navigator.clipboard.readText()).toBe(SECRET)
  await user.click(within(box).getByRole('button', { name: 'Copy Claude Code command' }))
  expect(await navigator.clipboard.readText()).toContain(`Bearer ${SECRET}`)
})

it('never keeps the token after the box is closed or the page is left', async () => {
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Laptop')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await userEvent.click(within(await screen.findByRole('region', { name: 'Your new token' })).getByRole('button', { name: 'Done' }))
  expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Name'), 'Second')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await screen.findByRole('region', { name: 'Your new token' })
  await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
  await userEvent.click(await screen.findByRole('link', { name: 'back' }))
  expect(await screen.findByText('Second')).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Your new token' })).not.toBeInTheDocument()
  expect(document.body.innerHTML).not.toContain(SECRET)
})

it('sends one request when Create is pressed twice', async () => {
  let release: () => void = () => {}
  vi.mocked(apiClient.post).mockImplementationOnce(
    () => new Promise((resolve) => (release = () => resolve({ data: { success: true, data: { ...item(), token: SECRET } } }))),
  )
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Laptop')
  const create = screen.getByRole('button', { name: 'Create token' })
  await userEvent.click(create)
  await userEvent.click(create)
  release()
  await screen.findByRole('region', { name: 'Your new token' })
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})

it('needs a name', async () => {
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), '   ')
  expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
})

it('lists tokens with their state and revokes after confirmation', async () => {
  stored = [
    item({ id: 't1', name: 'Laptop', lastUsedAt: '2026-10-02T09:00:00.000Z', expiresAt: '2026-11-01T08:00:00.000Z' }),
    item({ id: 't2', name: 'Old one', expiresAt: '2026-09-01T08:00:00.000Z', expired: true }),
  ]
  renderRoutes(routes, { route: '/account/tokens' })
  const laptop = (await screen.findByText('Laptop')).closest('li')!
  expect(laptop).toHaveTextContent('tcms_pat_abc')
  expect(laptop).toHaveTextContent('Last used')
  expect((screen.getByText('Old one').closest('li') as HTMLElement)).toHaveTextContent('Expired')
  await userEvent.click(within(laptop).getByRole('button', { name: 'Revoke Laptop' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Agents using "Laptop" will lose access right away.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke token' }))
  await waitFor(() => expect(screen.queryByText('Laptop')).not.toBeInTheDocument())
  expect(apiClient.delete).toHaveBeenCalledWith('/tokens/t1')
})

it('disables Create at 10 tokens that are not expired', async () => {
  stored = Array.from({ length: 10 }, (_, i) => item({ id: `t${i}`, name: `Token ${i}` }))
  renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByText('You have 10 tokens. Revoke one to create another.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create token' })).toBeDisabled()
})

it('offers a retry when the tokens cannot be loaded', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('down'))
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('You have no tokens yet.')).toBeInTheDocument()
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/account/tokens' })
  expect(await screen.findByRole('heading', { name: 'Přístupové tokeny' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Vytvořit token' })).toBeInTheDocument()
  expect(screen.getByText('Zatím nemáte žádný token.')).toBeInTheDocument()
})

it('moves focus to the new token so it is not missed', async () => {
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.type(await screen.findByLabelText('Name'), 'Laptop')
  await userEvent.click(screen.getByRole('button', { name: 'Create token' }))
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Your new token' })).toHaveFocus())
})

it('uses a Czech word for revoking that differs from Cancel', async () => {
  await setTestLanguage('cs')
  stored = [item({ id: 't1', name: 'Notebook' })]
  renderRoutes(routes, { route: '/account/tokens' })
  await userEvent.click(await screen.findByRole('button', { name: 'Odvolat Notebook' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(within(dialog).getByRole('button', { name: 'Odvolat token' })).toBeInTheDocument()
  expect(within(dialog).getByRole('heading')).toHaveTextContent('Odvolat tento token?')
})
