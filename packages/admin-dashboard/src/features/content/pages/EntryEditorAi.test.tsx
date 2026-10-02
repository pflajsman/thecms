import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import * as aiApi from '@/features/ai/ai-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return { ...actual, getEntry: vi.fn(), getContentType: vi.fn(), listContentTypes: vi.fn(), listEntries: vi.fn(), createEntry: vi.fn(), updateEntry: vi.fn(), publishEntry: vi.fn() }
})
vi.mock('@/features/ai/ai-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/ai/ai-api')>()
  return { ...actual, getAiStatus: vi.fn(), streamGenerate: vi.fn() }
})
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: ({ value }: { value: string }) => <textarea aria-label="rich text" defaultValue={value} /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const routes = [{ path: '/content/:id', element: <EntryEditorPage /> }]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(aiApi.getAiStatus).mockResolvedValue({
    available: true,
    enabled: true,
    canManage: false,
    connection: { provider: 'openai-compatible', model: 'm', createdAt: '2026-10-02' },
    usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 },
  })
})

it('offers AI on text fields and applies the suggestion as an unsaved edit with the entry as context', async () => {
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ id: 'e1', data: { title: 'Šumava' }, title: 'Šumava' }))
  vi.mocked(aiApi.streamGenerate).mockImplementation(async (_body, { onText }) => {
    onText('Šumava v létě')
    return { text: 'Šumava v létě', inputTokens: 1, outputTokens: 1 }
  })
  renderRoutes(routes, { route: '/content/e1' })
  await userEvent.click(await screen.findByRole('button', { name: 'AI for Title' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Rewrite more clearly' }))
  const panel = await screen.findByRole('region', { name: 'AI suggestion for Title' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Use' }))
  expect(screen.getByLabelText('Title')).toHaveValue('Šumava v létě')
  await waitFor(() => expect(screen.getByText('Unsaved changes')).toBeInTheDocument())
  const sent = vi.mocked(aiApi.streamGenerate).mock.calls[0][0]
  expect(sent).toMatchObject({ action: 'rewrite', field: { label: 'Title', type: 'TEXT', value: 'Šumava' }, context: { contentType: tripType.name, language: expect.any(String) } })
  expect(sent.context.fields.some((f) => f.label === 'Title')).toBe(false)
})

it('shows no AI buttons when the user is not connected', async () => {
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(null)
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ id: 'e1', data: { title: 'Šumava' }, title: 'Šumava' }))
  renderRoutes(routes, { route: '/content/e1' })
  await screen.findByLabelText('Title')
  expect(screen.queryByRole('button', { name: /^AI for/ })).not.toBeInTheDocument()
})
