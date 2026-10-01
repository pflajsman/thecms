import type { ShopProduct } from '../shop/types';

export const tee: ShopProduct = {
  id: 'p-tee',
  type: 'PHYSICAL',
  itemId: 'i-tee',
  currency: 'CZK',
  content: { data: { name: 'Cyklistické tričko', description: '<p>Merino vlna</p>', images: [] } },
  options: [{ key: 'size', label: 'Velikost', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] }],
  variants: [
    { id: 'v-tee-s', sku: 'TEE-S', optionValues: { size: 's' }, price: 49000, vatRate: 2100, available: true, availableQuantity: 3 },
    { id: 'v-tee-m', sku: 'TEE-M', optionValues: { size: 'm' }, price: 52000, vatRate: 2100, available: false, availableQuantity: 0 },
  ],
  priceRange: { min: 49000, max: 52000 },
};

export const guide: ShopProduct = {
  id: 'p-guide',
  type: 'DIGITAL',
  itemId: 'i-guide',
  currency: 'CZK',
  content: { data: { name: 'Průvodce Šumavou', description: '', images: [] } },
  options: [],
  variants: [{ id: 'v-guide', sku: 'GUIDE', optionValues: {}, price: 29900, vatRate: 1200, available: true, availableQuantity: null }],
  priceRange: { min: 29900, max: 29900 },
};
