import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { renderWithProviders, setTestLanguage } from '@/test/render'
import type { Field } from '@/types'
import * as api from '@/features/media/media-api'
import { makeMedia, mediaPage } from '@/features/media/test-fixtures'
import { moveItem } from '@/features/media/move-item'
import { MediaField } from './MediaField'

vi.mock('@/features/media/media-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/media/media-api')>()
  return { ...actual, listMedia: vi.fn(), uploadMedia: vi.fn() }
})

const gallery: Field = { name: 'gallery', label: 'Gallery', type: 'MEDIA', required: false, validation: { multiple: true, allowedMimeTypes: ['image/*'] } }
const cover: Field = { name: 'cover', label: 'Cover', type: 'MEDIA', required: false }

function Harness({ field, initial }: { field: Field; initial: unknown }) {
  const [value, setValue] = useState<unknown>(initial)
  return (
    <>
      <MediaField field={field} id="f" value={value} onChange={setValue} onBlur={() => {}} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

const a = makeMedia({ id: 'a', originalName: 'a.jpg' })
const b = makeMedia({ id: 'b', originalName: 'b.jpg' })

beforeEach(() => {
  vi.mocked(api.listMedia).mockImplementation(async (p) => mediaPage([a, b].filter((m) => !p.ids || p.ids.includes(m.id))))
})

it('moveItem reorders', () => {
  expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
})

describe('MediaField', () => {
  it('drag handles are not tab stops; the Move buttons are the keyboard path', async () => {
    renderWithProviders(<Harness field={gallery} initial={['a', 'b']} />)
    const list = await screen.findByRole('list', { name: 'Gallery files' })
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(2))
    await waitFor(() => expect(within(list).getByRole('button', { name: 'Move b.jpg earlier' })).toBeInTheDocument())
    expect(within(list).queryAllByRole('button', { name: /^Drag / })).toHaveLength(0)
  })

  it('shows thumbnails in order and reorders with the keyboard buttons', async () => {
    renderWithProviders(<Harness field={gallery} initial={['a', 'b']} />)
    const list = await screen.findByRole('list', { name: 'Gallery files' })
    await waitFor(() => expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([expect.stringContaining('a.jpg'), expect.stringContaining('b.jpg')]))
    await userEvent.click(screen.getByRole('button', { name: 'Move b.jpg earlier' }))
    expect(screen.getByTestId('value')).toHaveTextContent('["b","a"]')
  })

  it('shows a removable tile for a deleted file', async () => {
    renderWithProviders(<Harness field={gallery} initial={['a', 'gone']} />)
    expect(await screen.findByText('Missing file')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove missing file' }))
    expect(screen.getByTestId('value')).toHaveTextContent('["a"]')
  })

  it('uploads files dropped on the field and adds them', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'c', originalName: 'c.jpg' }))
    renderWithProviders(<Harness field={gallery} initial={['a']} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('["a","c"]'))
  })

  it('shows a Czech upload error once, without repeating the file name', async () => {
    await setTestLanguage('cs')
    renderWithProviders(<Harness field={gallery} initial={[]} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    const big = new File(['x'], 'mapa.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [big] } })
    expect(await screen.findByText('Soubor mapa.jpg je větší než 10 MB.')).toBeInTheDocument()
  })

  it('rejects dropped files the field does not accept', async () => {
    renderWithProviders(<Harness field={gallery} initial={[]} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'route.gpx', { type: 'application/gpx+xml' })] } })
    expect(await screen.findByText('route.gpx is not allowed in Gallery.')).toBeInTheDocument()
    await setTestLanguage('cs')
    expect(await screen.findByText('Soubor route.gpx není v poli Gallery povolen.')).toBeInTheDocument()
    expect(api.uploadMedia).not.toHaveBeenCalled()
  })

  it('replaces a single file value', async () => {
    vi.mocked(api.uploadMedia).mockResolvedValue(makeMedia({ id: 'c', originalName: 'c.jpg' }))
    renderWithProviders(<Harness field={cover} initial="a" />)
    const zone = await screen.findByRole('group', { name: 'Cover' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('"c"'))
  })

  it('keeps every file when several uploads finish close together', async () => {
    const resolvers: ((m: ReturnType<typeof makeMedia>) => void)[] = []
    vi.mocked(api.uploadMedia).mockImplementation(() => new Promise((r) => resolvers.push(r)))
    renderWithProviders(<Harness field={gallery} initial={['a']} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File(['x'], 'c.jpg', { type: 'image/jpeg' }), new File(['y'], 'd.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(resolvers).toHaveLength(2))
    resolvers[0](makeMedia({ id: 'c', originalName: 'c.jpg' }))
    await new Promise((r) => setTimeout(r, 0))
    resolvers[1](makeMedia({ id: 'd', originalName: 'd.jpg' }))
    await waitFor(() => expect(screen.getByTestId('value')).toHaveTextContent('["a","c","d"]'))
  })

  it('shows size errors and failed uploads in the field', async () => {
    vi.mocked(api.uploadMedia).mockRejectedValue(new Error('boom'))
    renderWithProviders(<Harness field={gallery} initial={[]} />)
    const zone = await screen.findByRole('group', { name: 'Gallery' })
    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files: [new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' }), new File(['x'], 'ok.jpg', { type: 'image/jpeg' })] } })
    expect(await screen.findByText(/big\.jpg is larger than 10 MB\./)).toBeInTheDocument()
    expect(await screen.findByText(/ok\.jpg: Something went wrong/)).toBeInTheDocument()
  })

  it('does not call files missing when the lookup fails', async () => {
    vi.mocked(api.listMedia).mockRejectedValue(new Error('down'))
    renderWithProviders(<Harness field={gallery} initial={['a']} />)
    expect(await screen.findByText('Could not load files.')).toBeInTheDocument()
    expect(screen.queryByText('Missing file')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })
})

