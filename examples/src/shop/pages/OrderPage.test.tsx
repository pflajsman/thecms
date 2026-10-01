import { screen } from '@testing-library/react';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import type { CustomerOrder } from '../types';
import { OrderPage } from './OrderPage';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

const routes = [{ path: '/objednavka/:number', element: <OrderPage /> }];
const base: CustomerOrder = {
  number: '2026000001',
  createdAt: '2026-10-01T10:00:00.000Z',
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
  currency: 'CZK',
  lines: [
    { name: 'Cyklistické tričko', optionLabels: [{ option: 'Velikost', value: 'S' }], quantity: 1, unitPrice: 49000, lineTotal: 49000, type: 'PHYSICAL' },
    { name: 'Průvodce Šumavou', optionLabels: [], quantity: 1, unitPrice: 29900, lineTotal: 29900, type: 'DIGITAL' },
  ],
  shipping: { name: 'Kurýr', price: 12900 },
  payment: {
    method: 'BANK_TRANSFER',
    fee: 0,
    instructions: { holder: 'Test Shop', iban: 'CZ6508000000192000145399', amount: 91800, currency: 'CZK', reference: '2026000001', qr: 'SPD*1.0*ACC:CZ6508000000192000145399*AM:918.00' },
  },
  totals: { items: 78900, shipping: 12900, paymentFee: 0, total: 91800, vat: [{ rate: 2100, base: 51314, amount: 10776 }, { rate: 1200, base: 26696, amount: 3204 }] },
};

function open(order: CustomerOrder | null, route = '/objednavka/2026000001?t=tok') {
  const api = mockApi({
    'GET /shop/orders/:number': () => (order ? ok(order) : { status: 404, body: { success: false, error: 'Order not found' } }),
  });
  renderRoutes(routes, route);
  return api;
}

it('shows bank transfer details with the variable symbol and the payment QR code', async () => {
  const api = open(base);
  expect(await screen.findByRole('heading', { name: 'Objednávka 2026000001' })).toBeInTheDocument();
  expect(screen.getByText('Variabilní symbol').nextElementSibling).toHaveTextContent('2026000001');
  expect(screen.getByText('IBAN').nextElementSibling).toHaveTextContent('CZ65 0800 0000 1920 0014 5399');
  expect(screen.getByText('Částka').nextElementSibling).toHaveTextContent(/918\sKč/);
  expect(await screen.findByRole('img', { name: 'QR kód pro platbu' })).toHaveAttribute('src', 'data:image/png;base64,QR');
  expect(screen.getByText(/1 × Cyklistické tričko \(S\)/)).toBeInTheDocument();
  expect(api.calls[0].url.searchParams.get('token')).toBe('tok');
});

it('tells a cash on delivery customer to pay on delivery', async () => {
  open({ ...base, lines: [base.lines[0]], payment: { method: 'CASH_ON_DELIVERY', fee: 3900 } });
  expect(await screen.findByText('Zaplatíte při převzetí zásilky.')).toBeInTheDocument();
});

it('says download links were emailed once a digital order is paid', async () => {
  open({ ...base, paymentStatus: 'PAID', payment: { method: 'BANK_TRANSFER', fee: 0 } });
  expect(await screen.findByText('Odkazy ke stažení jsme poslali na váš e-mail.')).toBeInTheDocument();
  expect(screen.queryByText('Variabilní symbol')).not.toBeInTheDocument();
});

it('shows the tracking link once shipped', async () => {
  open({ ...base, status: 'COMPLETED', paymentStatus: 'PAID', fulfilmentStatus: 'SHIPPED', payment: { method: 'BANK_TRANSFER', fee: 0 }, tracking: { number: 'DR123', url: 'https://track.test/DR123' } });
  expect(await screen.findByRole('link', { name: 'Sledovat zásilku' })).toHaveAttribute('href', 'https://track.test/DR123');
  expect(screen.getByText(/DR123/)).toBeInTheDocument();
});

it('says a cancelled order was cancelled', async () => {
  open({ ...base, status: 'CANCELLED', payment: { method: 'BANK_TRANSFER', fee: 0 } });
  expect(await screen.findByText('Objednávka byla zrušena.')).toBeInTheDocument();
});

it('shows nothing of the order for a wrong or missing token', async () => {
  open(null);
  expect(await screen.findByText('Objednávka nenalezena. Zkontrolujte prosím odkaz.')).toBeInTheDocument();
  expect(screen.queryByText('Cyklistické tričko')).not.toBeInTheDocument();
});

it('does not ask the API without a token', async () => {
  const api = open(base, '/objednavka/2026000001');
  expect(await screen.findByText('Objednávka nenalezena. Zkontrolujte prosím odkaz.')).toBeInTheDocument();
  expect(api.calls.filter((c) => c.key.startsWith('GET /shop/orders'))).toHaveLength(0);
});
