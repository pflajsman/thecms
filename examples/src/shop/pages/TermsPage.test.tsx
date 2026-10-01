import { screen } from '@testing-library/react';
import { mockApi } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { TermsPage } from './TermsPage';

const routes = [{ path: '/obchodni-podminky', element: <TermsPage /> }];

it('renders the terms page from the CMS', async () => {
  mockApi({
    'GET /content/page': () => ({
      body: { data: [{ id: 'e1', data: { key: 'obchodni-podminky', title: 'Obchodní podmínky', body: '<p>Prodávající: Pavel</p>' } }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
    }),
  });
  renderRoutes(routes, '/obchodni-podminky');
  expect(await screen.findByRole('heading', { name: 'Obchodní podmínky' })).toBeInTheDocument();
  expect(screen.getByText('Prodávající: Pavel')).toBeInTheDocument();
});

it('says when the terms are not written yet', async () => {
  mockApi({ 'GET /content/page': () => ({ body: { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } }) });
  renderRoutes(routes, '/obchodni-podminky');
  expect(await screen.findByText('Obchodní podmínky zatím nejsou k dispozici.')).toBeInTheDocument();
});
