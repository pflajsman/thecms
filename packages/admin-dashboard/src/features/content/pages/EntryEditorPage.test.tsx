import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import * as api from '../content-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'
import { i18n } from '@/i18n'

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
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/content', element: <p>content list</p> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
})

afterEach(() => vi.useRealTimers())

describe('new entry', () => {
  it('asks for the type when none is given', async () => {
    renderRoutes(routes, { route: '/content/new' })
    expect(await screen.findByRole('link', { name: /Trip/ })).toHaveAttribute('href', `/content/new?type=${tripType.id}`)
  })

  it('saves a draft, omits empty optional fields and stays in the editor without a leave prompt', async () => {
    vi.mocked(api.createEntry).mockResolvedValue(makeEntry({ id: 'e-new', data: { title: 'Hello' }, title: 'Hello' }))
    const { router } = renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    await userEvent.type(await screen.findByLabelText('Title'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/content/e-new'))
    expect(api.createEntry).toHaveBeenCalledWith(tripType.id, { data: { title: 'Hello' }, status: 'DRAFT' })
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Hello')
  })

  it('creates only once when saves overlap', async () => {
    let resolveCreate: (e: ReturnType<typeof makeEntry>) => void = () => {}
    vi.mocked(api.createEntry).mockImplementation(() => new Promise((r) => { resolveCreate = r }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ id: 'e-new', data: { title: 'Hi' } }))
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    await userEvent.type(await screen.findByLabelText('Title'), 'Hi')
    await userEvent.keyboard('{Meta>}s{/Meta}')
    await userEvent.keyboard('{Meta>}s{/Meta}')
    await act(async () => resolveCreate(makeEntry({ id: 'e-new', data: { title: 'Hi' } })))
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledTimes(1))
    expect(api.createEntry).toHaveBeenCalledTimes(1)
  })

  it('shows a required error on blur and does not save', async () => {
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.click(title)
    await userEvent.tab()
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    expect(api.createEntry).not.toHaveBeenCalled()
  })
})

describe('existing entries', () => {
  it('autosaves a draft 2 seconds after typing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry())
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ data: { title: 'Přes Šumavu!', distanceKm: 142 } }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoutes(routes, { route: '/content/e1' })
    await user.type(await screen.findByLabelText('Title'), '!')
    expect(api.updateEntry).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(2100) })
    await waitFor(() => expect(api.updateEntry).toHaveBeenCalledWith('e1', { data: { title: 'Přes Šumavu!', distanceKm: 142 } }))
  })

  it('never autosaves a published entry and publishes changes on request', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED', publishedAt: '2026-09-21T10:00:00Z' }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderRoutes(routes, { route: '/content/e1' })
    expect(await screen.findByRole('button', { name: 'Published' })).toBeDisabled()
    await user.type(screen.getByLabelText('Title'), '!')
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(api.updateEntry).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Publish changes' }))
    expect(api.updateEntry).toHaveBeenCalledTimes(1)
  })

  it('asks before leaving with unsaved changes', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    renderRoutes(routes, { route: '/content/e1' })
    await userEvent.type(await screen.findByLabelText('Title'), '!')
    await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText('Leave without saving?')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    expect(await screen.findByText('elsewhere page')).toBeInTheDocument()
  })

  it('publishes a draft', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry())
    vi.mocked(api.publishEntry).mockResolvedValue(makeEntry({ status: 'PUBLISHED' }))
    renderRoutes(routes, { route: '/content/e1' })
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    expect(api.publishEntry).toHaveBeenCalledWith('e1')
    expect(await screen.findByRole('button', { name: 'Published' })).toBeDisabled()
  })

  it('keeps archived entries read-only until restored', async () => {
    vi.mocked(api.getEntry).mockResolvedValue(makeEntry({ status: 'ARCHIVED' }))
    vi.mocked(api.updateEntry).mockResolvedValue(makeEntry({ status: 'DRAFT' }))
    renderRoutes(routes, { route: '/content/e1' })
    expect(await screen.findByLabelText('Title')).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Restore to draft' }))
    expect(api.updateEntry).toHaveBeenCalledWith('e1', { status: 'DRAFT' })
    await waitFor(() => expect(screen.getByLabelText('Title')).toBeEnabled())
  })
})

describe('in Czech', () => {
  it('shows editor actions and validation in Czech', async () => {
    await setTestLanguage('cs')
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.click(title)
    await userEvent.tab()
    expect(await screen.findByText('Title je povinné pole')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Uložit koncept' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publikovat' })).toBeInTheDocument()
  })

  it('keeps unsaved values when the language changes', async () => {
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.type(title, 'Přes Šumavu')
    await setTestLanguage('cs')
    expect(screen.getByLabelText('Title')).toHaveValue('Přes Šumavu')
    expect(screen.getByRole('button', { name: 'Uložit koncept' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Neuložené změny')
  })

  it.each([
    [1, 'Opravte 1 pole před uložením'],
    [2, 'Opravte 2 pole před uložením'],
    [5, 'Opravte 5 polí před uložením'],
  ])('asks to fix %i field(s) with the right Czech plural', async (count, message) => {
    await setTestLanguage('cs')
    expect(i18n.t('editor:fixFieldsToast', { count })).toBe(message)
  })

  it('re-translates a visible validation error when the language changes', async () => {
    renderRoutes(routes, { route: `/content/new?type=${tripType.id}` })
    const title = await screen.findByLabelText('Title')
    await userEvent.click(title)
    await userEvent.tab()
    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    await setTestLanguage('cs')
    expect(await screen.findByText('Title je povinné pole')).toBeInTheDocument()
    expect(screen.queryByText('Title is required')).not.toBeInTheDocument()
  })
})
