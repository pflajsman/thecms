import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShopSettingsPage } from './ShopSettingsPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/settings', element: <ShopSettingsPage /> }]
const saved = {
  currencies: [{ code: 'CZK', decimals: 2 }],
  defaultCurrency: 'CZK',
  vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: saved } })
  vi.mocked(apiClient.put).mockImplementation(async (_url: string, body: unknown) => ({ data: { success: true, data: body } }))
})

it('shows currencies and VAT rates and adds EUR and a reduced rate', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  const currencies = await screen.findByRole('list', { name: 'Currencies' })
  expect(within(currencies).getByText('CZK')).toBeInTheDocument()
  expect(within(currencies).getByText('Default')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Currency code'), 'eur')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  await userEvent.type(screen.getByLabelText('VAT rate name'), 'Reduced')
  await userEvent.type(screen.getByLabelText('Rate (%)'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Add VAT rate' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith('/commerce/settings', {
      currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
      defaultCurrency: 'CZK',
      vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }, { id: 'reduced', name: 'Reduced', rate: 1200 }],
    }),
  )
  await expectNoA11yViolations(container)
})

it('shows the server reason when a currency in use cannot be removed', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'Currency CZK has prices; remove them from the variants first' } } }))
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Remove CZK' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  expect(await screen.findByText(/Currency CZK has prices/)).toBeInTheDocument()
})

it('rejects a bad currency code and a rate over 100 %', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.type(await screen.findByLabelText('Currency code'), 'EURO')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  expect(screen.getByText('Use a three-letter code such as EUR')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('VAT rate name'), 'Wrong')
  await userEvent.type(screen.getByLabelText('Rate (%)'), '101')
  await userEvent.click(screen.getByRole('button', { name: 'Add VAT rate' }))
  expect(screen.getByText('Use a rate from 0 to 100')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  expect(await screen.findByRole('heading', { name: 'Nastavení obchodu' })).toBeInTheDocument()
  expect(await screen.findByText('Výchozí')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
