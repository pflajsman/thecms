import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { mockApi, ok, type MockResult } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { COURIER, quoteFor } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import type { OrderRequest, QuoteRequest } from '../types';
import { CheckoutPage } from './CheckoutPage';

function OrderProbe() {
  const location = useLocation();
  return <p>{`order ${location.pathname}${location.search}`}</p>;
}

const routes = [
  { path: '/pokladna', element: <CheckoutPage /> },
  { path: '/objednavka/:number', element: <OrderProbe /> },
];
const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', country: 'CZ' };
const placed = (status = 201): MockResult => ({ status, body: { success: true, data: { number: '2026000001', accessToken: 'tok', total: 0, currency: 'CZK', payment: { method: 'BANK_TRANSFER' } } } });
const setCart = (variantId: string, productId: string) => localStorage.setItem(CART_KEY, JSON.stringify([{ variantId, productId, quantity: 1 }]));
const orderButton = () => screen.getByRole('button', { name: 'Objednat s povinností platby' });

function serve(order: (body: OrderRequest) => MockResult | Promise<MockResult>, quote = (body: QuoteRequest) => ok(quoteFor(body))) {
  return mockApi({ 'GET /shop/shipping-countries': () => ok(['CZ', 'SK']), 'POST /shop/quote': quote, 'POST /shop/orders': order });
}

async function fillForm() {
  await userEvent.type(await screen.findByLabelText(/E-mail/), 'jana@example.test');
  await userEvent.type(screen.getByLabelText(/Jméno a příjmení/), 'Jana Nováková');
  await userEvent.type(screen.getByLabelText(/Ulice a číslo/), 'Hlavní 1');
  await userEvent.type(screen.getByLabelText(/^Město/), 'Praha');
  await userEvent.type(screen.getByLabelText(/^PSČ/), '110 00');
  await userEvent.click(screen.getByRole('checkbox', { name: /obchodními podmínkami/ }));
}

const ordersOf = (api: ReturnType<typeof serve>) => api.calls.filter((c) => c.key === 'POST /shop/orders');

it('places a cash on delivery order and opens the order page', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await userEvent.click(await screen.findByRole('radio', { name: /Dobírka/ }));
  await waitFor(() => expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/658\sKč/));
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText('order /objednavka/2026000001?t=tok')).toBeInTheDocument();
  const [call] = ordersOf(api);
  expect(call.body).toEqual({
    items: [{ variantId: 'v-tee-s', quantity: 1 }],
    country: 'CZ',
    shippingMethodId: COURIER,
    paymentMethod: 'CASH_ON_DELIVERY',
    language: 'cs',
    customer: { email: 'jana@example.test', name: 'Jana Nováková' },
    billingAddress: address,
    shippingAddress: address,
    acceptTerms: true,
    expectedTotal: 65800,
  });
  expect(call.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([]);
});

it('shows field errors and sends nothing', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(screen.getByText('Zadejte platný e-mail.')).toBeInTheDocument();
  expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(/E-mail/)).toHaveFocus();
  expect(screen.getByText('Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.')).toBeInTheDocument();
  expect(ordersOf(api)).toHaveLength(0);
});

it('shows new prices after a price change and sends the new total on the next click', async () => {
  setCart('v-tee-s', 'p-tee');
  let bumped = false;
  const api = serve(
    (body) => {
      if (!bumped) {
        bumped = true;
        return { status: 409, body: { success: false, error: 'Prices changed', reason: 'PRICE_CHANGED', quote: quoteFor(body, { bump: 1000 }) } };
      }
      return placed();
    },
    (body) => ok(quoteFor(body, { bump: bumped ? 1000 : 0 })),
  );
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText(/Ceny se mezitím změnily/)).toBeInTheDocument();
  expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/629\sKč/);
  expect(screen.queryByText(/order \//)).not.toBeInTheDocument();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  expect(ordersOf(api).map((c) => (c.body as OrderRequest).expectedTotal)).toEqual([61900, 62900]);
});

it('points to the cart when stock ran out', async () => {
  setCart('v-tee-s', 'p-tee');
  serve(() => ({ status: 409, body: { success: false, error: 'Out of stock', reason: 'OUT_OF_STOCK' } }));
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Některé zboží už není skladem');
  expect(within(alert).getByRole('link', { name: 'Upravit košík' })).toHaveAttribute('href', '/kosik');
});

it('keeps the form after a network failure and retries with the same key', async () => {
  setCart('v-tee-s', 'p-tee');
  let fail = true;
  const api = serve(() => {
    if (fail) {
      fail = false;
      throw new TypeError('Failed to fetch');
    }
    return placed();
  });
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText(/Nepodařilo se spojit se serverem/)).toBeInTheDocument();
  expect(screen.getByLabelText(/E-mail/)).toHaveValue('jana@example.test');
  await userEvent.click(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  const keys = ordersOf(api).map((c) => c.headers.get('Idempotency-Key'));
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

it('sends one order for a double click', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return placed();
  });
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.dblClick(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  expect(ordersOf(api)).toHaveLength(1);
});

it('offers only bank transfer and no delivery for a digital-only cart', async () => {
  setCart('v-guide', 'p-guide');
  serve(() => placed());
  renderRoutes(routes, '/pokladna');
  expect(await screen.findByRole('radio', { name: /Bankovní převod/ })).toBeChecked();
  expect(screen.queryByRole('radio', { name: /Dobírka/ })).not.toBeInTheDocument();
  expect(screen.queryByText('3. Doprava')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Doručit na jinou adresu' })).not.toBeInTheDocument();
});

it('says when the country cannot be shipped to and blocks the order', async () => {
  setCart('v-tee-s', 'p-tee');
  serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await screen.findByRole('option', { name: 'Slovensko' });
  await userEvent.selectOptions(screen.getByLabelText(/Země/), 'SK');
  expect(await screen.findByText('Do této země bohužel nedoručujeme.')).toBeInTheDocument();
  expect(orderButton()).toBeDisabled();
});
