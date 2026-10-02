import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { AiSettingsPage } from './AiSettingsPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/account/ai', element: <AiSettingsPage /> }]
const usage = { month: '2026-10', requests: 3, inputTokens: 1200, outputTokens: 450 }
const status = (over: Record<string, unknown> = {}) => ({ available: true, enabled: true, canManage: false, connection: null, usage, ...over })
const claude = { provider: 'anthropic', model: 'claude-sonnet-5', keyHint: 'abcd', createdAt: '2026-10-02T08:00:00.000Z' }

function serve(data: unknown) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data } })
}

beforeEach(() => {
  serve(status())
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => {
    if (url === '/ai/settings') return { data: { success: true, data: status({ canManage: true, enabled: (body as { enabled: boolean }).enabled }) } }
    const b = body as { provider: string; model: string; baseUrl?: string; apiKey?: string }
    return { data: { success: true, data: status({ connection: { provider: b.provider, model: b.model, baseUrl: b.baseUrl?.replace(/\/$/, ''), keyHint: b.apiKey ? b.apiKey.slice(-4) : undefined, createdAt: '2026-10-02T08:00:00.000Z' } }) } }
  })
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, data: status() } })
})

it('connects Claude with a key and shows only the key ending', async () => {
  const { container } = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByRole('heading', { name: 'AI assistant' })).toBeInTheDocument()
  expect(screen.getByRole('radio', { name: 'Claude (Anthropic)' })).toBeChecked()
  await userEvent.type(screen.getByLabelText('API key'), 'sk-ant-test-key-abcd')
  await userEvent.selectOptions(screen.getByLabelText('Model'), 'claude-opus-5-5')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'anthropic', model: 'claude-opus-5-5', apiKey: 'sk-ant-test-key-abcd' }))
  expect(await screen.findByText('Key ending …abcd')).toBeInTheDocument()
  expect(screen.queryByDisplayValue('sk-ant-test-key-abcd')).not.toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('connects a local Ollama from the preset without a key', async () => {
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('radio', { name: 'OpenAI-compatible service' }))
  await userEvent.selectOptions(screen.getByLabelText('Preset'), 'ollama')
  expect(screen.getByLabelText('Base URL')).toHaveValue('http://localhost:11434/v1')
  expect(screen.getByLabelText('Model name')).toHaveValue('llama3.2')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'openai-compatible', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1' }))
})

it('checks the form before sending', async () => {
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('button', { name: 'Connect' }))
  expect(screen.getByText('Enter the API key')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('radio', { name: 'OpenAI-compatible service' }))
  await userEvent.type(screen.getByLabelText('Base URL'), 'ftp://x')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(screen.getByText('Enter an http or https address')).toBeInTheDocument()
  expect(screen.getByText('Enter the model name')).toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalled()
})

it('explains a refused key', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(
    Object.assign(new Error('400'), { isAxiosError: true, response: { status: 400, data: { success: false, error: 'The AI service refused the key', reason: 'AUTH' } } }),
  )
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.type(await screen.findByLabelText('API key'), 'sk-ant-wrong')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('The AI service refused the key.')
})

it('changes only the model and keeps the stored key', async () => {
  serve(status({ connection: claude }))
  renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('button', { name: 'Change' }))
  expect(screen.getByText('Leave empty to keep the stored key.')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Model'), 'claude-haiku-4-5-20251001')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/connection', { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' }))
})

it('shows usage and disconnects after confirming', async () => {
  serve(status({ connection: claude }))
  renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText('3 requests, 1,200 input and 450 output tokens')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Disconnect the AI service?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Disconnect' }))
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/ai/connection'))
  expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
})

it('lets an admin switch AI off for everyone, and hides the switch from editors', async () => {
  serve(status({ canManage: true }))
  const first = renderRoutes(routes, { route: '/account/ai' })
  await userEvent.click(await screen.findByRole('switch', { name: 'Allow AI features for everyone' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/ai/settings', { enabled: false }))
  expect(await screen.findByText('AI features are turned off for this installation.')).toBeInTheDocument()
  first.unmount()
  serve(status())
  renderRoutes(routes, { route: '/account/ai' })
  await screen.findByRole('button', { name: 'Connect' })
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('explains when AI is not set up or the user has no access', async () => {
  serve(status({ available: false }))
  const first = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText(/AI is not set up on this server/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  first.unmount()
  vi.mocked(apiClient.get).mockRejectedValue(Object.assign(new Error('403'), { isAxiosError: true, response: { status: 403 } }))
  renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText('The AI assistant is available to editors and admins.')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  serve(status({ connection: claude, canManage: true }))
  const { container } = renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByRole('heading', { name: 'AI asistent' })).toBeInTheDocument()
  expect(screen.getByText('Konec klíče …abcd')).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Povolit AI funkce pro všechny' })).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('offers a retry when the status cannot be loaded', async () => {
  vi.mocked(apiClient.get).mockRejectedValueOnce(Object.assign(new Error('500'), { isAxiosError: true, response: { status: 500 } })).mockResolvedValue({ data: { success: true, data: status() } })
  renderRoutes(routes, { route: '/account/ai' })
  expect(await screen.findByText('Could not load the AI assistant settings.')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'Connect' })).toBeInTheDocument()
})
