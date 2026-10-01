import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import * as api from '../content-api'
import * as languagesApi from '@/features/languages/languages-api'
import { EntryEditorPage } from './EntryEditorPage'
import { makeEntry, tripType } from '../test-fixtures'

vi.mock('../content-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../content-api')>()),
  getEntry: vi.fn(),
  getContentType: vi.fn(),
  listContentTypes: vi.fn(),
  updateEntry: vi.fn(),
  listVersions: vi.fn(),
  createVersion: vi.fn(),
  changeLanguage: vi.fn(),
}))
vi.mock('@/features/languages/languages-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/languages/languages-api')>()),
  listLanguages: vi.fn(),
}))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const cs = { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }
const de = { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 2 }
const enEntry = makeEntry({ id: 'en1', itemId: 'en1', language: 'en', status: 'PUBLISHED', data: { title: 'Over the hills', distanceKm: 10 }, title: 'Over the hills' })
const csEntry = makeEntry({ id: 'cs1', itemId: 'en1', language: 'cs', data: { title: 'Přes kopce', distanceKm: 10 }, title: 'Přes kopce' })
const versions = [
  { id: 'en1', language: 'en', status: 'PUBLISHED' as const, title: 'Over the hills', updatedAt: '' },
  { id: 'cs1', language: 'cs', status: 'DRAFT' as const, title: 'Přes kopce', updatedAt: '' },
]
const routes = [
  { path: '/content/:id', element: <><EntryEditorPage /><Link to="/elsewhere">elsewhere</Link></> },
  { path: '/elsewhere', element: <p>elsewhere page</p> },
]

beforeEach(() => {
  vi.mocked(api.getContentType).mockResolvedValue(tripType)
  vi.mocked(api.listContentTypes).mockResolvedValue([tripType])
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'cs1' ? csEntry : enEntry))
  vi.mocked(api.listVersions).mockResolvedValue(versions)
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en, cs, de])
})

it('shows every language with its status or Missing, and opens another version', async () => {
  const { router, container } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
  expect(screen.getByRole('menuitem', { name: /Čeština.*Draft/ })).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: 'Translate to Deutsch' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: /Čeština/ }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/cs1'))
  expect(await screen.findByDisplayValue('Přes kopce')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('translates into a missing language and opens the new draft', async () => {
  vi.mocked(api.createVersion).mockResolvedValue(makeEntry({ id: 'de1', itemId: 'en1', language: 'de', data: enEntry.data, title: enEntry.title }))
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Language: English' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'Translate to Deutsch' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/de1'))
  expect(api.createVersion).toHaveBeenCalledWith('en1', 'de')
})

it('does not translate while there are unsaved changes, and guards switching language', async () => {
  const { router } = renderRoutes(routes, { route: '/content/cs1' })
  const title = await screen.findByDisplayValue('Přes kopce')
  await userEvent.type(title, '!')
  await userEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }))
  const translate = screen.getByRole('menuitem', { name: /Translate to Deutsch/ })
  expect(translate).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByText('Save your changes before translating')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('menuitem', { name: /English/ }))
  expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/content/cs1')
})

it('marks shared fields with "Same in all languages" and leaves translated ones alone', async () => {
  renderRoutes(routes, { route: '/content/en1' })
  const hint = await screen.findAllByText('Same in all languages')
  const distance = screen.getByLabelText('Distance (km)')
  // distanceKm (NUMBER) and published (BOOLEAN) are shared; the title is translated.
  expect(hint).toHaveLength(2)
  expect(distance.closest('div')?.parentElement).toHaveTextContent('Same in all languages')
})

it('changes the language of a version and warns when the default language would be left without one', async () => {
  vi.mocked(api.listVersions).mockResolvedValue([versions[0]])
  vi.mocked(api.changeLanguage).mockResolvedValue({ ...enEntry, language: 'de' })
  renderRoutes(routes, { route: '/content/en1' })
  const panel = await screen.findByRole('complementary', { name: 'Entry details' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Change language' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Change the language of this version' })
  await userEvent.click(within(dialog).getByRole('combobox', { name: 'Language' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Deutsch' }))
  expect(within(dialog).getByText(/no version in English, the default language/)).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Change language' }))
  await waitFor(() => expect(api.changeLanguage).toHaveBeenCalledWith('en1', 'de'))
})

it('says the delete removes only this language version when there are others', async () => {
  renderRoutes(routes, { route: '/content/cs1' })
  const panel = await screen.findByRole('complementary', { name: 'Entry details' })
  await userEvent.click(await within(panel).findByRole('button', { name: 'Delete' }))
  expect(await screen.findByText(/removes the Čeština version\. Other languages stay/)).toBeInTheDocument()
})

it('shows no language controls while only one language exists', async () => {
  vi.mocked(languagesApi.listLanguages).mockResolvedValue([en])
  vi.mocked(api.listVersions).mockResolvedValue([versions[0]])
  renderRoutes(routes, { route: '/content/en1' })
  await screen.findByDisplayValue('Over the hills')
  expect(screen.queryByRole('button', { name: /Language:/ })).not.toBeInTheDocument()
  expect(screen.queryByText('Same in all languages')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Change language' })).not.toBeInTheDocument()
})

it('works in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/content/en1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Jazyk: English' }))
  expect(screen.getByRole('menuitem', { name: 'Vytvořit překlad: Deutsch' })).toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  expect(screen.getAllByText('Stejné ve všech jazycích').length).toBeGreaterThan(0)
  await expectNoA11yViolations(container)
})

it('shows a shared value saved in another language when switching back', async () => {
  let enDistance = 10
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'cs1' ? csEntry : { ...enEntry, data: { ...enEntry.data, distanceKm: enDistance } }))
  vi.mocked(api.updateEntry).mockImplementation(async (_id, body) => {
    enDistance = 99
    return { ...csEntry, data: { ...csEntry.data, ...body.data } }
  })
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  expect(await screen.findByLabelText('Distance (km)')).toHaveValue(10)
  await router.navigate('/content/cs1')
  await waitFor(() => expect(screen.getByDisplayValue('Přes kopce')).toBeInTheDocument())
  const distance = screen.getByLabelText('Distance (km)')
  await userEvent.clear(distance)
  await userEvent.type(distance, '99')
  await userEvent.click(screen.getByRole('button', { name: 'Save draft' }))
  await waitFor(() => expect(api.updateEntry).toHaveBeenCalled())
  await screen.findByText('Draft saved')
  await router.navigate('/content/en1')
  await waitFor(() => expect(screen.getByDisplayValue('Over the hills')).toBeInTheDocument())
  expect(screen.getByLabelText('Distance (km)')).toHaveValue(99)
})

it('switching language waits for a save in progress, then opens the other version with the saved shared value', async () => {
  let enDistance = 10
  let finish: () => void = () => {}
  vi.mocked(api.getEntry).mockImplementation(async (id) => (id === 'cs1' ? csEntry : { ...enEntry, data: { ...enEntry.data, distanceKm: enDistance } }))
  vi.mocked(api.updateEntry).mockImplementation(
    (_id, body) =>
      new Promise((resolve) => {
        finish = () => {
          enDistance = 99
          resolve({ ...csEntry, data: { ...csEntry.data, ...body.data } })
        }
      }),
  )
  const { router } = renderRoutes(routes, { route: '/content/en1' })
  expect(await screen.findByLabelText('Distance (km)')).toHaveValue(10)
  await router.navigate('/content/cs1')
  await waitFor(() => expect(screen.getByDisplayValue('Přes kopce')).toBeInTheDocument())
  const distance = screen.getByLabelText('Distance (km)')
  await userEvent.clear(distance)
  await userEvent.type(distance, '99')
  // Opening the menu blurs the field, which starts the autosave.
  await userEvent.click(screen.getByRole('button', { name: 'Language: Čeština' }))
  await waitFor(() => expect(api.updateEntry).toHaveBeenCalled())
  await userEvent.click(screen.getByRole('menuitem', { name: /English/ }))
  expect(router.state.location.pathname).toBe('/content/cs1')
  finish()
  await waitFor(() => expect(router.state.location.pathname).toBe('/content/en1'))
  await waitFor(() => expect(screen.getByDisplayValue('Over the hills')).toBeInTheDocument())
  expect(screen.getByLabelText('Distance (km)')).toHaveValue(99)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})
