import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShippingPage } from './ShippingPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/shipping', element: <ShippingPage /> }]
const zones = [{ id: 'z1', name: 'Home', countries: ['CZ'], rest: false, order: 0 }]
const methods = [
  { id: 'm1', labels: { en: 'Courier', cs: 'Kurýr' }, active: true, paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: {}, rates: [{ zoneId: 'z1', bands: [{ upToGrams: null, prices: { CZK: 12900 } }] }], order: 0 },
]
const languages = [
  { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 },
  { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
]

function serve(data: { zones?: unknown[]; methods?: unknown[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/shipping/zones') return { data: { success: true, data: data.zones ?? zones } }
    if (url === '/commerce/shipping/methods') return { data: { success: true, data: data.methods ?? methods } }
    if (url === '/languages') return { data: { success: true, data: languages } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => {
  serve()
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => ({ data: { success: true, data: { id: 'z2', order: 1, ...(body as object) } } }))
})

it('lists zones with country names and methods with zones and payment', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/shipping' })
  const zoneList = await screen.findByRole('list', { name: 'Zones' })
  expect(within(zoneList).getByText('Home')).toBeInTheDocument()
  expect(within(zoneList).getByText('Czechia')).toBeInTheDocument()
  const methodList = screen.getByRole('list', { name: 'Shipping methods' })
  expect(within(methodList).getByRole('link', { name: 'Courier' })).toHaveAttribute('href', '/commerce/shipping/methods/m1')
  expect(within(methodList).getByText('Home · Bank transfer, Cash on delivery')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New method' })).toHaveAttribute('href', '/commerce/shipping/methods/new')
  await expectNoA11yViolations(container)
})

it('adds a zone from typed codes and refuses bad codes', async () => {
  renderRoutes(routes, { route: '/commerce/shipping' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add zone' }))
  const dialog = await screen.findByRole('dialog', { name: 'New zone' })
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Neighbours')
  await userEvent.type(within(dialog).getByLabelText('Countries'), 'sk, at, xyz')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save zone' }))
  expect(within(dialog).getByText('Use two-letter codes such as CZ: XYZ')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  const countries = within(dialog).getByLabelText('Countries')
  await userEvent.clear(countries)
  await userEvent.type(countries, 'sk, at')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save zone' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/shipping/zones', { name: 'Neighbours', countries: ['SK', 'AT'], rest: false }))
  expect(await screen.findByText('Zone saved')).toBeInTheDocument()
})

it('keeps a zone that a method uses and shows the reason', async () => {
  vi.mocked(apiClient.delete).mockRejectedValue(
    Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'A shipping method uses this zone' } } }),
  )
  renderRoutes(routes, { route: '/commerce/shipping' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Home' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete zone Home?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('A shipping method uses this zone')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Zones' })).getByText('Home')).toBeInTheDocument()
})

it('asks for a zone before the first method', async () => {
  serve({ zones: [], methods: [] })
  renderRoutes(routes, { route: '/commerce/shipping' })
  expect(await screen.findByText('Add a zone first.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New method' })).toBeDisabled()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/shipping' })
  expect(await screen.findByRole('heading', { name: 'Doprava' })).toBeInTheDocument()
  expect(await screen.findByText('Česko')).toBeInTheDocument()
  expect(screen.getByText('Home · Bankovní převod, Dobírka')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
