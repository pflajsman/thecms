import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShippingMethodPage } from './ShippingMethodPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [
  { path: '/commerce/shipping', element: <p>Shipping list</p> },
  { path: '/commerce/shipping/methods/:id', element: <ShippingMethodPage /> },
]
const zones = [{ id: 'z1', name: 'Home', countries: ['CZ'], rest: false, order: 0 }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] }
const languages = [
  { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 },
  { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
]
let methods: Record<string, unknown>[] = []

beforeEach(() => {
  methods = [
    { id: 'm1', labels: { en: 'Courier' }, active: true, paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: {}, rates: [{ zoneId: 'z1', bands: [{ upToGrams: null, prices: { CZK: 12900 } }] }], order: 0 },
  ]
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/shipping/zones') return { data: { success: true, data: zones } }
    if (url === '/commerce/shipping/methods') return { data: { success: true, data: methods } }
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/languages') return { data: { success: true, data: languages } }
    throw new Error(`unexpected GET ${url}`)
  })
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => {
    const created = { id: 'm2', order: 1, ...(body as object) }
    methods = [...methods, created]
    return { data: { success: true, data: created } }
  })
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => ({ data: { success: true, data: { id: url.split('/').pop(), order: 0, ...(body as object) } } }))
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } })
})

it('creates a method with a cash on delivery fee and an open last band', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/shipping/methods/new' })
  await userEvent.type(await screen.findByLabelText('Name (English)'), 'Parcel')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Cash on delivery' }))
  await userEvent.type(screen.getByLabelText('Cash on delivery fee in CZK'), '39')
  await userEvent.click(screen.getByRole('button', { name: 'Add rates for Home' }))
  await userEvent.type(screen.getByLabelText('Weight limit in grams, band 1'), '2000')
  await userEvent.type(screen.getByLabelText('Price in CZK, band 1'), '129')
  await userEvent.click(screen.getByRole('button', { name: 'Add band' }))
  await userEvent.type(screen.getByLabelText('Price in CZK, band 2'), '199.50')
  await userEvent.click(screen.getByRole('button', { name: 'Save method' }))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith('/commerce/shipping/methods', {
      labels: { en: 'Parcel' },
      active: true,
      paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'],
      codFees: { CZK: 3900 },
      freeOver: {},
      rates: [{ zoneId: 'z1', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19950 } }] }],
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Parcel' })).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('refuses a bad amount in Czech and saves "129,5" as 12950', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/commerce/shipping/methods/m1' })
  const price = await screen.findByLabelText('Cena v CZK, pásmo 1')
  expect(price).toHaveValue('129,00')
  await userEvent.clear(price)
  await userEvent.type(price, '129,5')
  const fee = screen.getByLabelText('Poplatek za dobírku v CZK')
  await userEvent.clear(fee)
  await userEvent.type(fee, 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit způsob' }))
  expect(screen.getByText('Zadejte částku, například 129,00')).toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalled()
  await userEvent.clear(fee)
  await userEvent.type(fee, '39')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit způsob' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled())
  const body = vi.mocked(apiClient.put).mock.calls[0][1] as { rates: { bands: { prices: Record<string, number> }[] }[]; codFees: Record<string, number> }
  expect(body.rates[0].bands[0].prices).toEqual({ CZK: 12950 })
  expect(body.codFees).toEqual({ CZK: 3900 })
})

it('turns a method off and deletes it', async () => {
  renderRoutes(routes, { route: '/commerce/shipping/methods/m1' })
  await userEvent.click(await screen.findByRole('switch', { name: 'Active' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save method' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/shipping/methods/m1', expect.objectContaining({ active: false })))
  await userEvent.click(screen.getByRole('button', { name: 'Delete method' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete Courier?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/commerce/shipping/methods/m1'))
  expect(await screen.findByText('Shipping list')).toBeInTheDocument()
})

it('says when the method no longer exists', async () => {
  renderRoutes(routes, { route: '/commerce/shipping/methods/gone' })
  expect(await screen.findByText('This shipping method no longer exists.')).toBeInTheDocument()
})
