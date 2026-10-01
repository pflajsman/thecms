import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { guide, tee } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import { ProductPage } from './ProductPage';

const routes = [{ path: '/obchod/:id', element: <ProductPage /> }];

it('opens on an available size and shows price and stock for the chosen one', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(tee) });
  renderRoutes(routes, '/obchod/p-tee');
  expect(await screen.findByRole('heading', { name: 'Cyklistické tričko' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'S' })).toBeChecked();
  expect(screen.getByText(/^490\sKč$/)).toBeInTheDocument();
  expect(screen.getByText('Skladem posledních 3 ks')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'M' }));
  expect(screen.getByText(/^520\sKč$/)).toBeInTheDocument();
  expect(screen.getByText('Vyprodáno')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Do košíku' })).toBeDisabled();
});

it('adds the chosen quantity to the cart and refuses more than the stock', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(tee) });
  renderRoutes(routes, '/obchod/p-tee');
  const quantity = await screen.findByLabelText('Počet');
  await userEvent.clear(quantity);
  await userEvent.type(quantity, '4');
  expect(screen.getByText('Zadejte počet od 1 do 3.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Do košíku' })).toBeDisabled();
  await userEvent.clear(quantity);
  await userEvent.type(quantity, '2');
  await userEvent.click(screen.getByRole('button', { name: 'Do košíku' }));
  expect(screen.getByRole('status')).toHaveTextContent('Přidáno do košíku.');
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 2 }]);
});

it('tells that a digital product is downloaded after payment', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(guide) });
  renderRoutes(routes, '/obchod/p-guide');
  expect(await screen.findByText('Ke stažení po zaplacení')).toBeInTheDocument();
});

it('says when the product does not exist', async () => {
  mockApi({ 'GET /shop/products/:id': () => ({ status: 404, body: { success: false, error: 'Product not found' } }) });
  renderRoutes(routes, '/obchod/nope');
  expect(await screen.findByText('Produkt nenalezen.')).toBeInTheDocument();
});
