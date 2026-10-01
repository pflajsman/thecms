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
  bankAccounts: [],
  unpaidCancelDays: 14,
  downloadDays: 30,
  downloadLimit: 5,
  termsUrl: 'https://shop.test/terms',
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

it('renames a VAT rate in place and keeps ids within 40 characters', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  const name = await screen.findByRole('textbox', { name: 'Name of Standard' })
  await userEvent.clear(name)
  await userEvent.type(name, 'Basic')
  await userEvent.type(screen.getByLabelText('VAT rate name'), 'Reduced rate for books newspapers and periodicals')
  await userEvent.type(screen.getByLabelText('Rate (%)'), '10')
  await userEvent.click(screen.getByRole('button', { name: 'Add VAT rate' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled())
  const body = vi.mocked(apiClient.put).mock.calls[0][1] as { vatRates: { id: string; name: string }[] }
  expect(body.vatRates[0]).toEqual({ id: 'standard', name: 'Basic', rate: 2100 })
  expect(body.vatRates[1].id.length).toBeLessThanOrEqual(40)
  expect(body.vatRates[1].id).toMatch(/^[a-z0-9-]+$/)
})

it('adds a bank account, clears the terms link and saves only checkout settings', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add bank account for CZK' }))
  await userEvent.type(screen.getByLabelText('Account holder'), 'Test Shop')
  await userEvent.type(screen.getByLabelText('IBAN'), 'cz65 0800 0000 1920 0014 5399')
  await userEvent.clear(screen.getByLabelText('Terms and conditions link'))
  const days = screen.getByLabelText('Cancel unpaid transfers after (days)')
  await userEvent.clear(days)
  await userEvent.type(days, '10')
  await userEvent.click(screen.getByRole('button', { name: 'Save checkout settings' }))
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith('/commerce/settings', {
      currencies: saved.currencies,
      defaultCurrency: 'CZK',
      vatRates: saved.vatRates,
      bankAccounts: [{ currency: 'CZK', holder: 'Test Shop', iban: 'CZ6508000000192000145399' }],
      unpaidCancelDays: 10,
      downloadDays: 30,
      downloadLimit: 5,
      shopEmail: null,
      termsUrl: null,
    }),
  )
  expect(await screen.findByText('Checkout settings saved')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  await expectNoA11yViolations(container)
})

it('marks a bank account without number or IBAN and a bad email, and sends nothing', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add bank account for CZK' }))
  await userEvent.type(screen.getByLabelText('Account holder'), 'Test Shop')
  await userEvent.type(screen.getByLabelText('Email for new orders'), 'shop@')
  await userEvent.click(screen.getByRole('button', { name: 'Save checkout settings' }))
  expect(screen.getByText('Enter an account number (up to 40 characters) or an IBAN')).toBeInTheDocument()
  expect(screen.getByText('Enter an email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Account number')).toHaveAttribute('aria-invalid', 'true')
  expect(apiClient.put).not.toHaveBeenCalled()
})

it('keeps unsaved checkout edits when the currencies are saved', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.type(await screen.findByLabelText('Email for new orders'), 'shop@example.test')
  await userEvent.type(screen.getByLabelText('Currency code'), 'EUR')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText('Email for new orders')).toHaveValue('shop@example.test')
  expect(screen.getByRole('button', { name: 'Save checkout settings' })).toBeEnabled()
})

it('renders the checkout section in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  expect(await screen.findByRole('heading', { name: 'Objednávky a platby' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Přidat bankovní účet pro CZK' })).toBeInTheDocument()
  expect(screen.getByLabelText('Odkaz na obchodní podmínky')).toHaveValue('https://shop.test/terms')
  await expectNoA11yViolations(container)
})
