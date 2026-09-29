import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../content-api'
import { ContentListPage } from './ContentListPage'
import { makeListItem, page, postType, tripType } from '../test-fixtures'
import { makeMedia, mediaPage } from '@/features/media/test-fixtures'
import * as mediaApi from '@/features/media/media-api'

vi.mock('../content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content-api')>()
  return {
    ...actual,
    listEntries: vi.fn(),
    listContentTypes: vi.fn(),
    updateEntry: vi.fn(),
    archiveEntry: vi.fn(),
    deleteEntry: vi.fn(),
  }
})
vi.mock('@/features/media/media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/media/media-api')>()
  return { ...actual, listMedia: vi.fn() }
})
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: { entries: { byType: { [tripType.id]: 8, [postType.id]: 12 } } } }),
  useUnreadCount: () => 0,
}))

const routes = [
  { path: '/content', element: <ContentListPage /> },
  { path: '/content/:id', element: <p>editor</p> },
  { path: '/models', element: <p>models</p> },
]

beforeEach(() => {
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType, postType])
})

describe('ContentListPage', () => {
  it('shows the cover image as a thumbnail', async () => {
    const coverType = { ...tripType, fields: [...tripType.fields, { name: 'cover', label: 'Cover', type: 'MEDIA' as const, required: false }] }
    vi.mocked(api.listContentTypes).mockResolvedValue([coverType, postType])
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ data: { title: 'Přes Šumavu', cover: 'm1' } })]))
    vi.mocked(mediaApi.listMedia).mockResolvedValue(mediaPage([makeMedia({ id: 'm1' })]))
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await waitFor(() => expect(table.querySelector('img')).toHaveAttribute('src', 'http://blob/media/a1b2-sumava-thumbnail.jpg'))
    expect(mediaApi.listMedia).toHaveBeenCalledWith({ ids: ['m1'], limit: 100 })
  })

  it('lists entries across types with titles, type, status and pager', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem(), makeListItem({ id: 'e2', title: 'Jak jsem stavěl CMS', status: 'PUBLISHED', contentType: { id: postType.id, name: 'Blog post', slug: 'blog-post' } })], 23))
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    expect(within(table).getByRole('link', { name: 'Přes Šumavu' })).toHaveAttribute('href', '/content/e1')
    expect(within(table).getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('1–20 of 23')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Trip\s*8/ })).toBeInTheDocument()
  })

  it('filters by type and resets the page', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()], 40))
    const { router } = renderRoutes(routes, { route: '/content?page=2' })
    await userEvent.click(await screen.findByRole('button', { name: /Trip\s*8/ }))
    await waitFor(() => expect(router.state.location.search).toBe(`?type=${tripType.id}`))
    expect(api.listEntries).toHaveBeenLastCalledWith(expect.objectContaining({ contentTypeId: tripType.id, page: 1 }))
  })

  it('debounces search into the URL', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()]))
    const { router } = renderRoutes(routes, { route: '/content' })
    await userEvent.type(await screen.findByRole('searchbox', { name: 'Search entries' }), 'šum')
    await waitFor(() => expect(router.state.location.search).toBe('?q=%C5%A1um'))
  })

  it('moves to the last page when the URL page is past the end', async () => {
    vi.mocked(api.listEntries).mockImplementation(async (p) => (p.page === 9 ? page([], 23, 9) : page([makeListItem()], 23, p.page)))
    const { router } = renderRoutes(routes, { route: '/content?page=9' })
    await waitFor(() => expect(router.state.location.search).toBe('?page=2'))
  })

  it('shows loading, not a false empty state, while jumping back from a page past the end', async () => {
    vi.mocked(api.listEntries).mockImplementation((p) => (p.page === 9 ? Promise.resolve(page([], 23, 9)) : new Promise(() => {})))
    renderRoutes(routes, { route: '/content?page=9' })
    await waitFor(() => expect(api.listEntries).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))
    expect(screen.getByLabelText('Loading entries')).toBeInTheDocument()
    expect(screen.queryByText('No entries yet')).not.toBeInTheDocument()
  })

  it('clears the search box together with the filters', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    renderRoutes(routes, { route: '/content?q=zzz' })
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Search entries' })).toHaveValue(''))
  })

  it('shows a clear-filters state when filters match nothing', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    const { router } = renderRoutes(routes, { route: '/content?q=zzz' })
    await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('asks for a content model first on an empty install', async () => {
    vi.mocked(api.listContentTypes).mockResolvedValue([])
    vi.mocked(api.listEntries).mockResolvedValue(page([]))
    renderRoutes(routes, { route: '/content' })
    expect(await screen.findByRole('link', { name: 'Create a content model' })).toHaveAttribute('href', '/models')
  })

  it('shows an error with retry', async () => {
    vi.mocked(api.listEntries).mockRejectedValueOnce(new Error('down')).mockResolvedValue(page([makeListItem()]))
    renderRoutes(routes, { route: '/content' })
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'Entries' })).toBeInTheDocument()
  })

  it('archives from the row menu with undo', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem({ status: 'PUBLISHED' })]))
    vi.mocked(api.archiveEntry).mockResolvedValue({ ...makeListItem(), status: 'ARCHIVED' } as never)
    vi.mocked(api.updateEntry).mockResolvedValue({ ...makeListItem(), status: 'PUBLISHED' } as never)
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Přes Šumavu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }))
    expect(api.archiveEntry).toHaveBeenCalledWith('e1')
    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(api.updateEntry).toHaveBeenCalledWith('e1', { status: 'PUBLISHED' })
  })

  it('confirms before deleting', async () => {
    vi.mocked(api.listEntries).mockResolvedValue(page([makeListItem()]))
    vi.mocked(api.deleteEntry).mockResolvedValue()
    renderRoutes(routes, { route: '/content' })
    const table = await screen.findByRole('table', { name: 'Entries' })
    await userEvent.click(within(table).getByRole('button', { name: 'Actions for Přes Šumavu' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    expect(api.deleteEntry).not.toHaveBeenCalled()
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
    expect(api.deleteEntry).toHaveBeenCalledWith('e1')
  })
})
