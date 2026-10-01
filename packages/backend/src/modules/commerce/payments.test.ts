import { providers, spdString } from './payments'

it('builds an SPD payment string with amount, currency and reference', () => {
  expect(spdString({ iban: 'CZ6508000000192000145399', amount: 248900, decimals: 2, currency: 'CZK', reference: '2026000001', message: 'Shop 2026000001' })).toBe(
    'SPD*1.0*ACC:CZ6508000000192000145399*AM:2489.00*CC:CZK*X-VS:2026000001*MSG:SHOP 2026000001',
  )
})

it('strips characters SPD does not allow from the message', () => {
  expect(spdString({ iban: 'CZ65', amount: 100, decimals: 2, currency: 'CZK', reference: '1', message: 'Kolo*Šumava' })).toContain('MSG:KOLO SUMAVA')
})

it('gives bank transfer instructions from the currency account, with a QR code only when there is an IBAN', () => {
  const order = { number: '2026000001', currency: 'CZK', totals: { total: 248900 } }
  const settings = {
    currencies: [{ code: 'CZK', decimals: 2 }],
    bankAccounts: [{ currency: 'CZK', accountNumber: '19-2000145399/0800', iban: 'CZ6508000000192000145399', holder: 'Pavel F.' }],
  }
  const withIban = providers.BANK_TRANSFER.instructions(order as never, settings as never)
  expect(withIban).toMatchObject({ holder: 'Pavel F.', accountNumber: '19-2000145399/0800', amount: 248900, reference: '2026000001' })
  expect(withIban?.qr).toMatch(/^SPD\*1\.0\*ACC:CZ65/)
  const noIban = providers.BANK_TRANSFER.instructions(order as never, { ...settings, bankAccounts: [{ currency: 'CZK', accountNumber: '1/0800', holder: 'P' }] } as never)
  expect(noIban?.qr).toBeUndefined()
  expect(providers.CASH_ON_DELIVERY.instructions(order as never, settings as never)).toBeUndefined()
})
