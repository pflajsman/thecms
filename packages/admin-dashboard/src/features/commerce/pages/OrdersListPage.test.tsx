import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { OrdersListPage } from './OrdersListPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/orders', element: <OrdersListPage /> }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }
const order = {
  id: 'o1',
  number: '2026000001',
  createdAt: '2026-10-01T10:00:00.000Z',
  customer: { name: 'Jana Nováková', email: 'jana@example.test' },
  total: 91800,
  currency: 'CZK',
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
}

function serve(orders: unknown[]) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/commerce/orders') return { data: { success: true, data: orders, pagination: { page: 1, limit: 20, total: orders.length, totalPages: 1 } } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => serve([order]))

it('lists orders with number, customer, total and statuses', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/orders' })
  const table = await screen.findByRole('table', { name: 'Orders' })
  expect(table).toHaveTextContent('Jana Nováková')
  expect(table).toHaveTextContent(/918\.00/)
  expect(table).toHaveTextContent('Unpaid')
  expect(table).toHaveTextContent('Not shipped')
  expect(table).toHaveTextContent('Open')
  expect(screen.getAllByRole('link', { name: '2026000001' })[0]).toHaveAttribute('href', '/commerce/orders/o1')
  await expectNoA11yViolations(container)
})

it('sends filters from the address and the needs action toggle', async () => {
  renderRoutes(routes, { route: '/commerce/orders?payment=PAID&shipping=UNFULFILLED&status=nonsense' })
  await screen.findByRole('table', { name: 'Orders' })
  expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders', { params: { paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', page: 1, limit: 20 } })
  const toggle = screen.getByRole('button', { name: 'Needs action' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(toggle)
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders', { params: { paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', needsAction: 'true', page: 1, limit: 20 } }),
  )
  expect(screen.getByRole('button', { name: 'Needs action' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows an empty state, and a different message when filters match nothing', async () => {
  serve([])
  const first = renderRoutes(routes, { route: '/commerce/orders' })
  expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  first.unmount()
  renderRoutes(routes, { route: '/commerce/orders?payment=PAID' })
  expect(await screen.findByText('No orders match these filters.')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/orders' })
  expect(await screen.findByRole('heading', { name: 'Objednávky' })).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Objednávky' })
  expect(table).toHaveTextContent('Nezaplaceno')
  expect(table).toHaveTextContent(/918,00\s?Kč/)
  await expectNoA11yViolations(container)
})
