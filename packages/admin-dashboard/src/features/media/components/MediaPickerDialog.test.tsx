import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import * as api from '../media-api'
import { MediaPickerDialog } from './MediaPickerDialog'
import { makeMedia, mediaPage } from '../test-fixtures'

vi.mock('../media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../media-api')>()
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() }
})

const photo = makeMedia()
const gpx = makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined })

beforeEach(() => vi.mocked(api.listMedia).mockResolvedValue(mediaPage([photo, gpx])))

describe('MediaPickerDialog', () => {
  it('selects one item and confirms', async () => {
    const onSelect = vi.fn()
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={onSelect} />)
    await userEvent.click(await screen.findByRole('button', { name: /sumava\.jpg/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose 1 file' }))
    expect(onSelect).toHaveBeenCalledWith([photo])
  })

  it('only allows accepted types', async () => {
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={vi.fn()} accept={['application/gpx+xml']} />)
    expect(await screen.findByRole('button', { name: /sumava\.jpg/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /route\.gpx/ })).toBeEnabled()
  })

  it('limits the list to images for image-only fields', async () => {
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={vi.fn()} accept={['image/*']} />)
    await waitFor(() => expect(api.listMedia).toHaveBeenCalledWith(expect.objectContaining({ category: 'image' })))
  })

  it('selects files uploaded from inside the picker', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'm9', originalName: 'new.jpg' }))
    const onSelect = vi.fn()
    renderWithProviders(<MediaPickerDialog open onOpenChange={() => {}} onSelect={onSelect} multiple />)
    await userEvent.upload(await screen.findByLabelText('Upload files'), new File(['x'], 'new.jpg', { type: 'image/jpeg' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Choose 1 file' }))
    expect(onSelect).toHaveBeenCalledWith([expect.objectContaining({ id: 'm9' })])
  })
})
