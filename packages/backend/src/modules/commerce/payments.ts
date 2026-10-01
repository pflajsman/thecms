import type { IShopSettings } from '../../models/shop-settings.model';
import type { PaymentMethod } from '../../models/shipping.model';

export interface PaymentInstructions {
  holder: string
  accountNumber?: string
  iban?: string
  bic?: string
  amount: number
  currency: string
  reference: string
  qr?: string
}

export interface OrderLike { number: string; currency: string; totals: { total: number } }

export interface PaymentProvider {
  method: PaymentMethod
  instructions(order: OrderLike, settings: Pick<IShopSettings, 'currencies' | 'bankAccounts'>): PaymentInstructions | undefined
}

/** SPD (Czech QR payment) string. Characters outside SPD's set are replaced; "*" separates fields. */
export function spdString(p: { iban: string; amount: number; decimals: number; currency: string; reference: string; message: string }): string {
  const message = p.message.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 $%+\-./:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  const amount = (p.amount / 10 ** p.decimals).toFixed(p.decimals);
  return `SPD*1.0*ACC:${p.iban}*AM:${amount}*CC:${p.currency}*X-VS:${p.reference}*MSG:${message}`;
}

const bankTransfer: PaymentProvider = {
  method: 'BANK_TRANSFER',
  instructions(order, settings) {
    const account = settings.bankAccounts?.find((a) => a.currency === order.currency);
    if (!account) return undefined;
    const decimals = settings.currencies.find((c) => c.code === order.currency)?.decimals ?? 2;
    return {
      holder: account.holder,
      accountNumber: account.accountNumber,
      iban: account.iban,
      bic: account.bic,
      amount: order.totals.total,
      currency: order.currency,
      reference: order.number,
      ...(account.iban ? { qr: spdString({ iban: account.iban, amount: order.totals.total, decimals, currency: order.currency, reference: order.number, message: `Shop ${order.number}` }) } : {}),
    };
  },
};

const cashOnDelivery: PaymentProvider = { method: 'CASH_ON_DELIVERY', instructions: () => undefined };

export const providers: Record<PaymentMethod, PaymentProvider> = { BANK_TRANSFER: bankTransfer, CASH_ON_DELIVERY: cashOnDelivery };
