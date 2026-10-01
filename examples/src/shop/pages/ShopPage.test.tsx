import { screen } from '@testing-library/react';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { guide, tee } from '../../test/shop-fixtures';
import { ShopPage } from './ShopPage';

const routes = [{ path: '/obchod', element: <ShopPage /> }];

it('lists products with a price range and marks sold-out ones', async () => {
  const soldOutGuide = { ...guide, variants: [{ ...guide.variants[0], available: false }] };
  mockApi({ 'GET /shop/products': () => ok([tee, soldOutGuide]) });
  renderRoutes(routes, '/obchod');
  const teeLink = await screen.findByRole('link', { name: /Cyklistické tričko/ });
  expect(teeLink).toHaveAttribute('href', '/obchod/p-tee');
  expect(teeLink).toHaveTextContent(/od 490\sKč/);
  const guideLink = screen.getByRole('link', { name: /Průvodce Šumavou/ });
  expect(guideLink).toHaveTextContent(/299\sKč/);
  expect(guideLink).toHaveTextContent('vyprodáno');
  expect(teeLink).not.toHaveTextContent('vyprodáno');
});

it('says when there is nothing for sale', async () => {
  mockApi({ 'GET /shop/products': () => ok([]) });
  renderRoutes(routes, '/obchod');
  expect(await screen.findByText('Zatím tu nic není.')).toBeInTheDocument();
});
