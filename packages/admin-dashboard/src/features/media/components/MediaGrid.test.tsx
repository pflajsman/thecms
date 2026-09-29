import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MediaGrid } from './MediaGrid'
import { MediaFilters } from './MediaFilters'
import { makeMedia } from '../test-fixtures'

const items = [
  makeMedia(),
  makeMedia({ id: 'm2', originalName: 'route.gpx', mimeType: 'application/gpx+xml', variants: [], thumbnailUrl: undefined }),
]

describe('MediaGrid', () => {
  it('shows image previews and type icons, and opens items', async () => {
    const onActivate = vi.fn()
    const { container } = render(<MediaGrid label="Media" items={items} onActivate={onActivate} />)
    // Decorative previews use alt="" (no img role), so select the element directly.
    expect(container.querySelector('img')).toHaveAttribute('src', 'http://blob/media/a1b2-sumava-small.jpg')
    expect(screen.getByText('GPX')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /route\.gpx/ }))
    expect(onActivate).toHaveBeenCalledWith(items[1])
  })

  it('in select mode shows selection and disabled items', async () => {
    const onActivate = vi.fn()
    render(<MediaGrid label="Media" mode="select" items={items} selectedIds={['m1']} disabled={(m) => m.id === 'm2'} onActivate={onActivate} />)
    expect(screen.getByRole('button', { name: /sumava\.jpg/ })).toHaveAttribute('aria-pressed', 'true')
    const gpx = screen.getByRole('button', { name: /route\.gpx/ })
    expect(gpx).toBeDisabled()
    await userEvent.click(gpx)
    expect(onActivate).not.toHaveBeenCalled()
  })
})

describe('MediaFilters', () => {
  it('changes category and debounces search', async () => {
    const onChange = vi.fn()
    render(<MediaFilters value={{ search: '' }} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Images' }))
    expect(onChange).toHaveBeenLastCalledWith({ search: '', category: 'image' })
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search media' }), 'sum')
    await vi.waitFor(() => expect(onChange).toHaveBeenLastCalledWith({ search: 'sum', category: undefined }))
  })
})
