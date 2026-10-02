import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import * as languagesApi from '@/features/languages/languages-api'
import * as aiApi from '@/features/ai/ai-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../content-api')>()),
  getEntry: vi.fn(),
  getContentType: vi.fn(),
  listContentTypes: vi.fn(),
  updateEntry: vi.fn(),
  listVersions: vi.fn(),
  createVersion: vi.fn(),
}))
vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))
vi.mock('@/features/ai/ai-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/ai/ai-api')>()),
  getAiStatus: vi.fn(),
  streamTranslate: vi.fn(),
}))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const de = { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 1 }
const enEntry = makeEntry({ id: 'en1', itemId: 'en1', language: 'en', status: 'PUBLISHED', data: { title: 'Over the hills', distanceKm: 10 }, title: 'Over the hills' })
const deEntry = makeEntry({ id: 'de1', itemId: 'en1', language: 'de', data: { title: 'Über die Hügel', distanceKm: 10 }, title: 'Über die Hügel' })
const enOnly = [{ id: 'en1', language: 'en', status: 'PUBLISHED' as const, title: 'Over the hills', updatedAt: '' }]
const withDe = [...enOnly, { id: 'de1', language: 'de', status: 'DRAFT' as const, title: 'Über die Hügel', updatedAt: '' }]
const ready = { available: true, enabled: true, canManage: false, connection: { provider: 'openai-compatible' as const, model: 'm', createdAt: '2026-10-02' }, usage: { month: '2026-10', requests: 0, inputTokens: 0, outputTokens: 0 } }
const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'de1' ? deEntry : enEntry))
  vi.mocked(api.listVersions).mockResolvedValue(enOnly)
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en, de])
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(ready)
})

async function openMenu() {
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
}

it('offers AI translation only when AI is ready', async () => {
  vi.mocked(aiApi.getAiStatus).mockResolvedValue(null)
  renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch' })).toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Translate to Deutsch with AI' })).not.toBeInTheDocument()
})

it('translates with AI and opens the new draft', async () => {
  vi.mocked(aiApi.streamTranslate).mockImplementation(async (_body, options) => {
    options.onStart([{ name: 'title', label: 'Title' }])
    options.onField('title', 1)
    vi.mocked(api.listVersions).mockResolvedValue(withDe)
    return { versionId: 'de1', inputTokens: 1, outputTokens: 1 }
  })
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Translate to Deutsch with AI' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
  expect(aiApi.streamTranslate).toHaveBeenCalledWith({ entryId: 'en1', language: 'de' }, expect.anything())
  expect(await screen.findByDisplayValue('Über die Hügel')).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('opens the version created meanwhile', async () => {
  vi.mocked(aiApi.streamTranslate).mockImplementation(async () => {
    vi.mocked(api.listVersions).mockResolvedValue(withDe)
    throw new aiApi.AiRequestError('VERSION_EXISTS', 'exists')
  })
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await openMenu()
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Translate to Deutsch with AI' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Open the Deutsch version' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
})

it('keeps the AI item disabled while there are unsaved changes', async () => {
  renderRoutes(routes, { route: '/content/en1' })
  await userEvent.type(await screen.findByDisplayValue('Over the hills'), '!')
  await openMenu()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch with AI' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Save your changes before translating')).toBeInTheDocument()
})
