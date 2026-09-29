import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes } from '@/test/render'
import * as api from '../media-api'
import { MediaLibraryPage } from './MediaLibraryPage'
import { makeMedia, mediaPage } from '../test-fixtures'

vi.mock('../media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media-api')>()
  return { ...actual, listMedia: vi.fn(), getMedia: vi.fn(), uploadMedia: vi.fn(), updateMedia: vi.fn(), deleteMedia: vi.fn(), getMediaUsage: vi.fn() }
})

const routes = [
  { path: '/media', element: <MediaLibraryPage /> },
  { path: '/content/:id', element: <p>entry page</p> },
]

beforeEach(() => {
  vi.mocked(api.listMedia).mockResolvedValue(mediaPage([makeMedia(), makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined })]))
  vi.mocked(api.getMedia).mockImplementation(async (id) => (id === 'm1' ? makeMedia() : makeMedia({ id })))
  vi.mocked(api.getMediaUsage).mockResolvedValue([])
})

describe('MediaLibraryPage', () => {
  it('lists media and filters by type through the URL', async () => {
    const { router } = renderRoutes(routes, { route: '/media' })
    expect(await screen.findByRole('button', { name: /sumava\.jpg/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Images' }))
    await waitFor(() => expect(router.state.location.search).toBe('?category=image'))
    expect(api.listMedia).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'image', page: 1 }))
  })

  it('uploads files dropped anywhere and refreshes the grid', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'm3', originalName: 'new.png' }))
    renderRoutes(routes, { route: '/media' })
    await screen.findByRole('button', { name: /sumava\.jpg/ })
    const file = new File(['x'], 'new.png', { type: 'image/png' })
    fireEvent.dragEnter(window, { dataTransfer: { types: ['Files'], files: [file] } })
    expect(await screen.findByText('Drop files to upload')).toBeInTheDocument()
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [file] } })
    await waitFor(() => expect(api.uploadMedia).toHaveBeenCalledWith(file, expect.any(Function)))
    expect(await screen.findByText('Uploads finished')).toBeInTheDocument()
    await waitFor(() => expect(api.listMedia).toHaveBeenCalledTimes(2))
  })

  it('opens details, flags missing alt text and saves metadata', async () => {
    vi.mocked(api.updateMedia).mockResolvedValue(makeMedia({ altText: 'Forest trail' }))
    const { router } = renderRoutes(routes, { route: '/media' })
    await userEvent.click(await screen.findByRole('button', { name: /sumava\.jpg/ }))
    await waitFor(() => expect(router.state.location.search).toBe('?item=m1'))
    const sheet = await screen.findByRole('dialog', { name: 'sumava.jpg' })
    expect(within(sheet).getByText('Add alt text so people using screen readers know what the image shows.')).toBeInTheDocument()
    await userEvent.type(within(sheet).getByLabelText('Alt text'), 'Forest trail')
    await userEvent.type(within(sheet).getByLabelText('Tags'), 'bike, šumava')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }))
    expect(api.updateMedia).toHaveBeenCalledWith('m1', { altText: 'Forest trail', description: '', tags: ['bike', 'šumava'] })
  })

  it('shows where the file is used and warns before deleting it', async () => {
    vi.mocked(api.getMediaUsage).mockResolvedValue([
      { id: 'e1', title: 'Přes Šumavu', status: 'PUBLISHED', contentType: { id: 't', name: 'Trip', slug: 'trip' } },
      { id: 'e2', title: 'Krkonoše', status: 'DRAFT', contentType: { id: 't', name: 'Trip', slug: 'trip' } },
    ])
    vi.mocked(api.deleteMedia).mockResolvedValue()
    renderRoutes(routes, { route: '/media?item=m1' })
    const sheet = await screen.findByRole('dialog', { name: 'sumava.jpg' })
    expect(await within(sheet).findByRole('link', { name: 'Přes Šumavu' })).toHaveAttribute('href', '/content/e1')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Delete file' }))
    const confirm = await screen.findByRole('alertdialog')
    expect(within(confirm).getByText(/2 entries use this file/)).toBeInTheDocument()
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
    expect(api.deleteMedia).toHaveBeenCalledWith('m1')
  })

  it('shows an empty state with an upload action', async () => {
    vi.mocked(api.listMedia).mockResolvedValue(mediaPage([]))
    renderRoutes(routes, { route: '/media' })
    expect(await screen.findByText('No media yet')).toBeInTheDocument()
  })

  it('does not allow deleting before usage is known', async () => {
    vi.mocked(api.getMediaUsage).mockImplementation(() => new Promise(() => {}))
    renderRoutes(routes, { route: '/media?item=m1' })
    const sheet = await screen.findByRole('dialog', { name: 'sumava.jpg' })
    expect(within(sheet).getByRole('button', { name: 'Delete file' })).toBeDisabled()
  })
})

