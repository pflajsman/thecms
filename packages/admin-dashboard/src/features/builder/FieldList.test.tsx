import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FieldList, type FieldListItem } from './FieldList'

const items: FieldListItem[] = [
  { id: 'a', label: 'Title', apiKey: 'title', typeLabel: 'Text', isTitle: true },
  { id: 'b', label: 'Body', apiKey: 'body', typeLabel: 'Rich text' },
  { id: 'c', label: 'Cover', apiKey: 'cover', typeLabel: 'Media', hasError: true },
]

it('selects and reorders fields', async () => {
  const onSelect = vi.fn()
  const onReorder = vi.fn()
  render(<FieldList label="Fields" items={items} selectedId="b" onSelect={onSelect} onReorder={onReorder} />)
  expect(screen.getByRole('button', { name: /^Body/ })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByText('Title field')).toBeInTheDocument()
  expect(screen.getByText('Has errors')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /^Cover/ }))
  expect(onSelect).toHaveBeenCalledWith('c')
  await userEvent.click(screen.getByRole('button', { name: 'Move Body down' }))
  expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b'])
  expect(screen.queryByRole('button', { name: 'Move Title up' })).not.toBeInTheDocument()
})
