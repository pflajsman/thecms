/** Shapes of the TheCMS public shop API (/public/shop/*). Money is in minor units. */

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
export type ProductType = 'PHYSICAL' | 'DIGITAL';

export interface ShopSettings {
  currencies: { code: string; decimals: number }[];
  defaultCurrency?: string;
}

export interface ShopVariant {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  vatRate: number;
  available: boolean;
  /** null when stock is not tracked. */
  availableQuantity: number | null;
}

export interface ShopProduct {
  id: string;
  type: ProductType;
  itemId: string;
  currency: string;
  /** The linked content entry; `data` has name, description and images. */
  content: { data: Record<string, unknown> };
  options: { key: string; label: string; values: { key: string; label: string }[] }[];
  variants: ShopVariant[];
  priceRange: { min: number; max: number } | null;
}

export interface CartItem {
  variantId: string;
  productId: string;
  quantity: number;
}

export type LineProblem = 'NOT_FOR_SALE' | 'NO_PRICE' | 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK';

export interface OptionLabel {
  option: string;
  value: string;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  type: ProductType;
  name: string;
  optionLabels: OptionLabel[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  problem?: LineProblem;
  availableQuantity?: number | null;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  paymentMethods: { method: PaymentMethod; fee: number }[];
}

export interface Totals {
  items: number;
  shipping: number;
  paymentFee: number;
  total: number;
  vat: { rate: number; base: number; amount: number }[];
}

export interface Quote {
  currency: string;
  lines: QuoteLine[];
  hasPhysical: boolean;
  hasDigital: boolean;
  shippingOptions: ShippingOption[];
  shipping: { methodId: string; name: string; price: number } | null;
  payment: { method: PaymentMethod; fee: number } | null;
  totals: Totals;
  /** 'LINES', 'NO_SHIPPING', 'SHIPPING_REQUIRED', 'PAYMENT_NOT_ALLOWED' */
  problems: string[];
}

export interface QuoteRequest {
  items: { variantId: string; quantity: number }[];
  country?: string;
  shippingMethodId?: string;
  paymentMethod?: PaymentMethod;
}

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  vatId?: string;
}

export interface OrderRequest extends QuoteRequest {
  customer: { email: string; name: string; phone?: string };
  billingAddress: Address;
  shippingAddress?: Address;
  note?: string;
  acceptTerms: boolean;
  expectedTotal: number;
}

export interface PaymentInstructions {
  holder: string;
  accountNumber?: string;
  iban?: string;
  bic?: string;
  amount: number;
  currency: string;
  reference: string;
  /** SPD payment string for the QR code; present when the account has an IBAN. */
  qr?: string;
}

export interface PlacedOrder {
  number: string;
  accessToken: string;
  total: number;
  currency: string;
  payment: { method: PaymentMethod; instructions?: PaymentInstructions };
}

export interface CustomerOrder {
  number: string;
  createdAt: string;
  status: 'PLACED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  fulfilmentStatus: 'UNFULFILLED' | 'SHIPPED';
  currency: string;
  lines: { name: string; optionLabels: OptionLabel[]; quantity: number; unitPrice: number; lineTotal: number; type: ProductType }[];
  shipping: { name: string; price: number } | null;
  payment: { method: PaymentMethod; fee: number; instructions?: PaymentInstructions };
  totals: Totals;
  tracking?: { number?: string; url?: string };
}
