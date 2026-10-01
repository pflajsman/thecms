import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { quoteFor } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import type { QuoteRequest } from '../types';
import { CartPage } from './CartPage';

const routes = [{ path: '/kosik', element: <CartPage /> }];
const setCart = (items: { variantId: string; productId: string; quantity: number }[]) => localStorage.setItem(CART_KEY, JSON.stringify(items));

it('shows the lines with prices from the quote and the subtotal', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 2 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body)) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByRole('link', { name: 'Cyklistické tričko' })).toHaveAttribute('href', '/obchod/p-tee');
  expect(screen.getByText('Velikost: S')).toBeInTheDocument();
  expect(screen.getByText('Mezisoučet').parentElement).toHaveTextContent(/980\sKč/);
  expect(screen.getByRole('link', { name: 'K pokladně' })).toHaveAttribute('href', '/pokladna');
});

it('offers to lower a quantity above the stock and blocks checkout until then', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 3 }]);
  const api = mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body, { stock: { 'v-tee-s': 1 } })) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByText('Skladem jen 1 ks.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'K pokladně' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Snížit na 1' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  await waitFor(() => expect(screen.getByRole('link', { name: 'K pokladně' })).toBeInTheDocument());
  expect(api.calls.filter((c) => c.key === 'POST /shop/quote').at(-1)?.body).toMatchObject({ items: [{ variantId: 'v-tee-s', quantity: 1 }] });
});

it('changes quantities and removes lines', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body)) });
  renderRoutes(routes, '/kosik');
  await userEvent.click(await screen.findByRole('button', { name: 'Přidat kus: Cyklistické tričko' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)[0].quantity).toBe(2);
  await userEvent.click(screen.getByRole('button', { name: 'Odebrat Cyklistické tričko' }));
  expect(await screen.findByText('Košík je prázdný.')).toBeInTheDocument();
});

it('marks an item that is no longer sold', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok({ ...quoteFor(body), lines: [{ ...quoteFor(body).lines[0], problem: 'NOT_FOR_SALE', lineTotal: 0 }] }) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByText('Už není v prodeji')).toBeInTheDocument();
});
