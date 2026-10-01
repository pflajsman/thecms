import { checkoutToForm, formToCheckout } from './checkout-form'

const base = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }

it('fills defaults and turns empty email and terms into null', () => {
  const form = checkoutToForm(base)
  expect(form).toEqual({ accounts: [], unpaidCancelDays: '14', downloadDays: '30', downloadLimit: '5', shopEmail: '', termsUrl: '' })
  expect(formToCheckout(form).body).toEqual({ bankAccounts: [], unpaidCancelDays: 14, downloadDays: 30, downloadLimit: 5, shopEmail: null, termsUrl: null })
})

it('normalises an IBAN typed with spaces and drops empty optional fields', () => {
  const form = { ...checkoutToForm(base), accounts: [{ currency: 'CZK', holder: ' Test Shop ', accountNumber: '', iban: 'cz65 0800 0000 1920 0014 5399', bic: '' }] }
  expect(formToCheckout(form).body?.bankAccounts).toEqual([{ currency: 'CZK', holder: 'Test Shop', iban: 'CZ6508000000192000145399' }])
})

it('names every invalid field and returns no body', () => {
  const form = {
    accounts: [{ currency: 'CZK', holder: '', accountNumber: '', iban: '', bic: 'ABC' }],
    unpaidCancelDays: '0',
    downloadDays: '1,5',
    downloadLimit: '101',
    shopEmail: 'shop@',
    termsUrl: 'ftp://x',
  }
  const result = formToCheckout(form)
  expect(result.body).toBeUndefined()
  expect(result.errors).toEqual({
    'account-CZK-holder': 'holder',
    'account-CZK-accountNumber': 'account',
    'account-CZK-bic': 'bic',
    'unpaid-days': 'unpaidCancelDays',
    'download-days': 'downloadDays',
    'download-limit': 'downloadLimit',
    'shop-email': 'email',
    'terms-url': 'url',
  })
})
