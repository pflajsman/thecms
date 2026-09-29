import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { RichTextEditor } from './RichTextEditor'

vi.mock('@/features/media/components/MediaPickerDialog', () => ({ MediaPickerDialog: () => null }))

it('renders the content and a labelled toolbar', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hello <strong>world</strong></p>" onChange={() => {}} />)
  expect(await screen.findByText('world')).toBeInTheDocument()
  const toolbar = screen.getByRole('toolbar', { name: 'Formatting' })
  for (const name of ['Bold', 'Italic', 'Underline', 'Bullet list', 'Numbered list', 'Quote', 'Link', 'Insert image']) {
    expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument()
  }
  expect(screen.getByRole('textbox')).toHaveAttribute('aria-multiline', 'true')
})

it('toggles bold and reflects it in the toolbar', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  const bold = await screen.findByRole('button', { name: 'Bold' })
  expect(bold).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(bold)
  await waitFor(() => expect(bold).toHaveAttribute('aria-pressed', 'true'))
})

it('refuses a javascript: link', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Link' }))
  await userEvent.type(await screen.findByLabelText('Link URL'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Apply link' }))
  expect(screen.getByText('Use a web address (https://…), an email (mailto:…) or a page path (/about)')).toBeInTheDocument()
  expect(document.querySelector('.ProseMirror a')).toBeNull()
})
