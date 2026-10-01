import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { LanguagesPage } from './LanguagesPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const en = { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }
const cs = { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }
const routes = [{ path: '/languages', element: <LanguagesPage /> }]

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async (url: string, config?: { params?: Record<string, unknown> }) => {
    if (url === '/languages') return { data: { success: true, data: [en, cs] } }
    if (url === '/entries' && config?.params?.language === 'cs')
      return { data: { success: true, data: [], pagination: { page: 1, limit: 1, total: 4, totalPages: 4 } } }
    return { data: { success: true, data: [] } }
  })
})

it('lists languages with the default marked and no Delete on the default', async () => {
  const { container } = renderRoutes(routes, { route: '/languages' })
  const list = await screen.findByRole('list', { name: 'Languages' })
  const rows = within(list).getAllByRole('listitem')
  expect(rows[0]).toHaveTextContent('English')
  expect(rows[0]).toHaveTextContent('en')
  expect(rows[0]).toHaveTextContent('Default')
  await userEvent.click(within(rows[0]).getByRole('button', { name: 'Actions for English' }))
  expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  expect(screen.queryByRole('menuitem', { name: 'Make default' })).not.toBeInTheDocument()
  await userEvent.keyboard('{Escape}')
  await expectNoA11yViolations(container)
})

it('adds a language and shows the server message when it already exists', async () => {
  vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { success: true, data: { id: 'l3', code: 'de', name: 'Deutsch', isDefault: false, order: 2 } } })
  renderRoutes(routes, { route: '/languages' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add language' }))
  const dialog = await screen.findByRole('dialog', { name: 'Add language' })
  await userEvent.type(within(dialog).getByLabelText('Code'), 'Deutsch!')
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Deutsch')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add language' }))
  expect(within(dialog).getByText('Use a code such as en, cs or de-at')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  await userEvent.clear(within(dialog).getByLabelText('Code'))
  await userEvent.type(within(dialog).getByLabelText('Code'), 'DE')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Add language' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/languages', { code: 'de', name: 'Deutsch' }))
  expect(await screen.findByText('Added Deutsch')).toBeInTheDocument()
})

it('makes a language the default after confirming', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: { ...cs, isDefault: true } } })
  renderRoutes(routes, { route: '/languages' })
  const rows = within(await screen.findByRole('list', { name: 'Languages' })).getAllByRole('listitem')
  await userEvent.click(within(rows[1]).getByRole('button', { name: 'Actions for Čeština' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Make default' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Make Čeština the default language?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Make default' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/languages/cs/default'))
})

it('deletes a language only after the code is typed, and says how many versions go with it', async () => {
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, data: { deletedVersions: 4 } } })
  renderRoutes(routes, { route: '/languages' })
  const rows = within(await screen.findByRole('list', { name: 'Languages' })).getAllByRole('listitem')
  await userEvent.click(within(rows[1]).getByRole('button', { name: 'Actions for Čeština' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete Čeština?' })
  expect(await within(confirm).findByText(/also deletes 4 entry versions/)).toBeInTheDocument()
  const button = within(confirm).getByRole('button', { name: 'Delete' })
  expect(button).toBeDisabled()
  await userEvent.type(within(confirm).getByRole('textbox'), 'cs')
  await userEvent.click(button)
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/languages/cs', { params: { confirm: 'cs' } }))
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/languages' })
  expect(await screen.findByRole('heading', { name: 'Jazyky' })).toBeInTheDocument()
  expect(await screen.findByText('Výchozí')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
