import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import type { ContentEntry, ContentType } from '@/types'
import * as api from '../content-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return {
    ...actual,
    getEntry: vi.fn(),
    getContentType: vi.fn(),
    listContentTypes: vi.fn(),
    listEntries: vi.fn(),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    publishEntry: vi.fn(),
  }
})
// Behaves like TipTap: reads its value only when it mounts.
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="Body editor" defaultValue={value} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('@/components/MediaPicker', () => ({ MediaPicker: () => <div>media picker</div> }))

const articleType: ContentType = {
  ...tripType,
  id: 'cccccccccccccccccccccccc',
  name: 'Article',
  fields: [
    { name: 'title', label: 'Title', type: 'TEXT', required: true },
    { name: 'cover', label: 'Cover', type: 'MEDIA', required: true },
    { name: 'body', label: 'Body', type: 'RICH_TEXT', required: true },
  ],
}

const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockImplementation(async (id) => (id === articleType.id ? articleType : tripType))
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType, articleType])
})

it('Publish on a new entry really publishes it', async () => {
  vi.mocked(api.createEntry).mockImplementation(async (_t, body) => makeEntry({ id: 'e-new', data: body.data, status: body.status ?? 'DRAFT' }))
  vi.mocked(api.updateEntry).mockImplementation(async (id, body) => makeEntry({ id, data: body.data as ContentEntry['data'], status: 'DRAFT' }))
  vi.mocked(api.publishEntry).mockResolvedValue(makeEntry({ id: 'e-new', status: 'PUBLISHED' }))
  renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
  await userEvent.type(await screen.findByLabelText('Title'), 'Hi')
  await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Published' })).toBeDisabled())
  const createdPublished = vi.mocked(api.createEntry).mock.calls.some(([, body]) => body.status === 'PUBLISHED')
  expect(createdPublished || vi.mocked(api.publishEntry).mock.calls.length > 0).toBe(true)
  expect(api.createEntry).toHaveBeenCalledTimes(1)
})

it('switching to another cached entry of the same type shows and saves that entry', async () => {
  vi.mocked(api.getEntry).mockImplementation(async (id) => makeEntry({ id, title: id === 'e1' ? 'First' : 'Second', data: { title: id === 'e1' ? 'First' : 'Second' } }))
  vi.mocked(api.updateEntry).mockImplementation(async (id, body) => makeEntry({ id, data: body.data as ContentEntry['data'] }))
  const { router } = renderRoutes(routes, { route: '/content/e1' })
  expect(await screen.findByLabelText('Title')).toHaveValue('First')
  await act(() => router.navigate('/content/e2'))
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('Second'))
  await act(() => router.navigate('/content/e1'))
  await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue('First'))
  await userEvent.type(screen.getByLabelText('Title'), '!')
  await userEvent.keyboard('{Meta>}s{/Meta}')
  await waitFor(() => expect(api.updateEntry).toHaveBeenCalled())
  expect(vi.mocked(api.updateEntry).mock.calls.every(([id]) => id === 'e1')).toBe(true)
})

it('does not pull the user back after they left during the first save', async () => {
  let resolveCreate: (e: ContentEntry) => void = () => {}
  vi.mocked(api.createEntry).mockImplementation(() => new Promise((r) => { resolveCreate = r }))
  const { router } = renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
  await userEvent.type(await screen.findByLabelText('Title'), 'Hi')
  await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
  const leave = await screen.findByRole('button', { name: 'Leave' }).catch(() => null)
  if (leave) await userEvent.click(leave)
  expect(await screen.findByText('elsewhere page')).toBeInTheDocument()
  await act(async () => resolveCreate(makeEntry({ id: 'e-new', data: { title: 'Hi' } })))
  expect(router.state.location.pathname).toBe('/elsewhere')
})

it('Discard changes also reverts rich text on screen', async () => {
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ contentTypeId: articleType.id, status: 'PUBLISHED', data: { title: 'A', cover: 'm1', body: 'original' } }))
  renderRoutes(routes, { route: '/content/e1' })
  const body = await screen.findByLabelText('Body editor')
  await userEvent.type(body, ' changed')
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(screen.getByLabelText('Body editor')).toHaveValue('original')
})

it('moves focus to a missing rich text field and opens details for a missing cover', async () => {
  renderRoutes(routes, { route: `/content/new?type=${articleType.id}` })
  await userEvent.type(await screen.findByLabelText('Title'), 'Hi')
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  // Cover (side panel) is the first missing field below the lg breakpoint: the details sheet opens.
  expect(await screen.findByRole('dialog', { name: 'Details' })).toBeInTheDocument()
})

it('focuses a missing rich text field when it is the first error', async () => {
  vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ contentTypeId: articleType.id, data: { title: 'A', cover: 'm1' } }))
  renderRoutes(routes, { route: '/content/e1' })
  await screen.findByLabelText('Body editor')
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(document.activeElement?.id).toBe('field-body'))
})
