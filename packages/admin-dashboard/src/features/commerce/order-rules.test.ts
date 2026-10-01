import { availableActions } from './order-rules'

const physical = { type: 'PHYSICAL' as const }
const digital = { type: 'DIGITAL' as const }

it('offers payment, shipping and cancel on an open unpaid order', () => {
  expect(availableActions({ status: 'PLACED', paymentStatus: 'UNPAID', fulfilmentStatus: 'UNFULFILLED', lines: [physical, digital] })).toEqual({
    markPaid: true,
    ship: true,
    cancel: true,
    resendConfirmation: true,
    resendDownloads: false,
  })
})

it('never ships a digital-only order and resends downloads once paid', () => {
  expect(availableActions({ status: 'COMPLETED', paymentStatus: 'PAID', fulfilmentStatus: 'SHIPPED', lines: [digital] })).toEqual({
    markPaid: false,
    ship: false,
    cancel: false,
    resendConfirmation: true,
    resendDownloads: true,
  })
  expect(availableActions({ status: 'PLACED', paymentStatus: 'UNPAID', fulfilmentStatus: 'UNFULFILLED', lines: [digital] }).ship).toBe(false)
})

it('offers nothing on a cancelled order', () => {
  expect(Object.values(availableActions({ status: 'CANCELLED', paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', lines: [physical, digital] }))).toEqual([false, false, false, false, false])
})
