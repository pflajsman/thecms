import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders, setTestLanguage } from '@/test/render'
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

it('inserts an image by URL without submitting a surrounding form', async () => {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
  renderWithProviders(
    <form onSubmit={onSubmit}>
      <RichTextEditor value="<p>Hi</p>" onChange={() => {}} />
    </form>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Insert image' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'By URL' }))
  const input = await screen.findByLabelText('Image URL')
  await userEvent.type(input, 'javascript:alert(1){Enter}')
  expect(await screen.findByText('Enter an image address starting with https://')).toBeInTheDocument()
  await userEvent.clear(input)
  await userEvent.type(input, 'https://example.com/a.jpg{Enter}')
  await waitFor(() => expect(document.querySelector('.ProseMirror img')).toHaveAttribute('src', 'https://example.com/a.jpg'))
  expect(onSubmit).not.toHaveBeenCalled()
})

it('applies a link without submitting a surrounding form', async () => {
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
  renderWithProviders(
    <form onSubmit={onSubmit}>
      <RichTextEditor value="<p>Hi</p>" onChange={() => {}} />
    </form>,
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Link' }))
  await userEvent.type(await screen.findByLabelText('Link URL'), 'https://example.com{Enter}')
  await waitFor(() => expect(screen.queryByLabelText('Link URL')).not.toBeInTheDocument())
  expect(onSubmit).not.toHaveBeenCalled()
})

it('labels the toolbar in Czech and refuses a javascript: link with a Czech hint', async () => {
  await setTestLanguage('cs')
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  const toolbar = await screen.findByRole('toolbar', { name: 'Formátování' })
  expect(within(toolbar).getByRole('button', { name: 'Tučně' })).toBeInTheDocument()
  await userEvent.click(within(toolbar).getByRole('button', { name: 'Odkaz' }))
  await userEvent.type(await screen.findByLabelText('Adresa odkazu'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Použít odkaz' }))
  expect(screen.getByText('Zadejte webovou adresu (https://…), e-mail (mailto:…) nebo cestu ke stránce (/o-nas)')).toBeInTheDocument()
})

it('re-translates a link error that is already shown', async () => {
  renderWithProviders(<RichTextEditor value="<p>Hi</p>" onChange={() => {}} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Link' }))
  await userEvent.type(await screen.findByLabelText('Link URL'), 'javascript:alert(1)')
  await userEvent.click(screen.getByRole('button', { name: 'Apply link' }))
  expect(screen.getByText(/Use a web address/)).toBeInTheDocument()
  await setTestLanguage('cs')
  expect(screen.getByText(/Zadejte webovou adresu/)).toBeInTheDocument()
})
