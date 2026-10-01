import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { Address, Order } from '../../orders-api'
import { formatMoney } from '../../money'
import { countryName } from '../../countries'

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
      <h2 id={id} className="mb-1 font-serif text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function AddressLines({ address }: { address: Address }) {
  const { t, i18n } = useTranslation('orders')
  return (
    <>
      <p>{address.name}</p>
      {address.company && <p>{address.company}</p>}
      <p>{address.street}</p>
      <p>{address.postalCode} {address.city}</p>
      <p>{countryName(address.country, i18n.language)}</p>
      {address.vatId && <p className="text-muted-foreground">{t('order.vatId', { id: address.vatId })}</p>}
    </>
  )
}

export function OrderDetails({ order, currency }: { order: Order; currency: { code: string; decimals: number } }) {
  const { t, i18n } = useTranslation('orders')
  const instructions = order.instructions
  return (
    <div className="space-y-4">
      <Block id="order-customer" title={t('order.customer')}>
        <p>{order.customer.name}</p>
        <p>
          <a href={`mailto:${order.customer.email}`} className="underline-offset-2 hover:underline">{order.customer.email}</a>
        </p>
        {order.customer.phone && <p>{order.customer.phone}</p>}
      </Block>
      <Block id="order-billing" title={t('order.billing')}>
        <AddressLines address={order.billingAddress} />
      </Block>
      {order.shippingAddress && (
        <Block id="order-shipping" title={t('order.shipping')}>
          <AddressLines address={order.shippingAddress} />
        </Block>
      )}
      <Block id="order-payment" title={t('order.payment')}>
        <p>{t(`method.${order.payment.method}`)}</p>
        {order.payment.method === 'BANK_TRANSFER' && <p>{t('order.reference', { reference: order.payment.reference })}</p>}
        {instructions && (
          <div className="mt-2 space-y-0.5 rounded-lg bg-muted px-3 py-2">
            <p className="font-medium">{t('order.instructions')}</p>
            <p>{t('order.holder', { holder: instructions.holder })}</p>
            {instructions.accountNumber && <p>{t('order.accountNumber', { number: instructions.accountNumber })}</p>}
            {instructions.iban && <p className="break-all">{t('order.iban', { iban: instructions.iban })}</p>}
            {instructions.bic && <p>{t('order.bic', { bic: instructions.bic })}</p>}
            <p>{t('order.amount', { amount: formatMoney(instructions.amount, currency, i18n.language) })}</p>
          </div>
        )}
      </Block>
      {order.tracking && (order.tracking.number || order.tracking.url) && (
        <Block id="order-tracking" title={t('order.tracking')}>
          {order.tracking.number && <p>{t('order.trackingNumber', { number: order.tracking.number })}</p>}
          {order.tracking.url && (
            <p>
              <a href={order.tracking.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{t('order.trackingLink')}</a>
            </p>
          )}
        </Block>
      )}
      {order.note && (
        <Block id="order-note" title={t('order.customerNote')}>
          <p className="whitespace-pre-wrap">{order.note}</p>
        </Block>
      )}
    </div>
  )
}
