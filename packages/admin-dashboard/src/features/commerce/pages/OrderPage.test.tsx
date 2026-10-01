import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { OrderPage } from './OrderPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/orders/:id', element: <OrderPage /> }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }
const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '11000', country: 'CZ' }
const base = {
  id: 'o1',
  number: '2026000001',
  accessToken: 'secret',
  currency: 'CZK',
  language: 'cs',
  customer: { email: 'jana@example.test', name: 'Jana Nováková', phone: '+420 777 000 111' },
  billingAddress: address,
  shippingAddress: address,
  note: 'Ring twice',
  lines: [
    { productId: 'p1', variantId: 'v1', itemId: 'i1', sku: 'TEE-S', name: 'Cyklistické tričko', optionLabels: [{ option: 'Size', value: 'S' }], type: 'PHYSICAL', unitPrice: 49000, quantity: 1, vatRate: 2100, lineTotal: 49000, weightGrams: 500 },
    { productId: 'p2', variantId: 'v2', itemId: 'i2', sku: 'GUIDE', name: 'Průvodce Šumavou', optionLabels: [], type: 'DIGITAL', unitPrice: 29900, quantity: 1, vatRate: 1200, lineTotal: 29900, weightGrams: 0 },
  ],
  shipping: { methodId: 'm1', name: 'Courier', price: 12900 },
  payment: { method: 'BANK_TRANSFER', fee: 0, reference: '2026000001' },
  totals: { items: 78900, shipping: 12900, paymentFee: 0, total: 91800, vat: [{ rate: 2100, base: 51314, amount: 10776 }, { rate: 1200, base: 26696, amount: 3204 }] },
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
  history: [
    { at: '2026-10-01T10:00:00.000Z', type: 'placed' },
    { at: '2026-10-01T10:00:01.000Z', type: 'email-failed', detail: 'confirmation: email is not configured' },
  ],
  createdAt: '2026-10-01T10:00:00.000Z',
  instructions: { holder: 'Test Shop', iban: 'CZ6508000000192000145399', amount: 91800, currency: 'CZK', reference: '2026000001' },
}

function serve(order: Record<string, unknown> = base) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/commerce/orders/o1') return { data: { success: true, data: order } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => {
  serve()
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: base } })
  vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: base } })
})

const orderCalls = () => vi.mocked(apiClient.get).mock.calls.filter((c) => c[0] === '/commerce/orders/o1').length

it('shows lines, totals, customer, addresses, payment instructions and history', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/orders/o1' })
  expect(await screen.findByRole('heading', { name: 'Order 2026000001' })).toBeInTheDocument()
  const lines = screen.getByRole('list', { name: 'Order items' })
  expect(within(lines).getByText('Size: S')).toBeInTheDocument()
  expect(within(lines).getByText('Download')).toBeInTheDocument()
  expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/918\.00/)
  expect(screen.getByText('Ring twice')).toBeInTheDocument()
  expect(screen.getAllByText('Czechia').length).toBeGreaterThan(0)
  expect(screen.getByText('IBAN: CZ6508000000192000145399')).toBeInTheDocument()
  expect(screen.getByText('Email not sent')).toBeInTheDocument()
  expect(screen.getByText('confirmation: email is not configured')).toBeInTheDocument()
  const actions = screen.getByRole('group', { name: 'Order actions' })
  expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Mark as paid', 'Mark as shipped', 'Cancel order', 'Resend confirmation'])
  await expectNoA11yViolations(container)
})

it('marks the order paid after confirming', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as paid' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Mark order 2026000001 as paid?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/paid'))
  expect(await screen.findByText('Order marked as paid')).toBeInTheDocument()
})

it('ships with tracking and refuses a bad tracking link', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as shipped' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mark order 2026000001 as shipped' })
  await userEvent.type(within(dialog).getByLabelText('Tracking number'), 'DR123')
  await userEvent.type(within(dialog).getByLabelText('Tracking link'), 'ftp://x')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }))
  expect(within(dialog).getByText('Enter an http or https link')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  const link = within(dialog).getByLabelText('Tracking link')
  await userEvent.clear(link)
  await userEvent.type(link, 'https://track.test/DR123')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/shipped', { trackingNumber: 'DR123', trackingUrl: 'https://track.test/DR123' }))
})

it('cancels a paid order and asks about the refund', async () => {
  serve({ ...base, paymentStatus: 'PAID', instructions: undefined })
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  const dialog = await screen.findByRole('dialog', { name: 'Cancel order 2026000001?' })
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Mark the payment as refunded' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/cancel', { refunded: true }))
})

it('shows the reason when an action is no longer possible and reloads the order', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(
    Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'This action is not possible for the order in its current state' } } }),
  )
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Resend confirmation' }))
  expect(await screen.findByText('This action is not possible for the order in its current state')).toBeInTheDocument()
  await waitFor(() => expect(orderCalls()).toBe(2))
})

it('saves the internal note', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  const note = await screen.findByLabelText('Internal note')
  expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled()
  await userEvent.type(note, 'Called the customer')
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/orders/o1/note', { note: 'Called the customer' }))
  expect(await screen.findByText('Note saved')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/orders/o1' })
  expect(await screen.findByRole('heading', { name: 'Objednávka 2026000001' })).toBeInTheDocument()
  expect(screen.getByText('Variabilní symbol: 2026000001')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Označit jako zaplacené' })).toBeInTheDocument()
  expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/918,00\s?Kč/)
  expect(screen.getAllByText('Česko').length).toBeGreaterThan(0)
  await expectNoA11yViolations(container)
})
