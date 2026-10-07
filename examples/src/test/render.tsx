import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, createRoutesFromElements, RouterProvider } from 'react-router-dom';
import { routes } from '../App';

/** Renders the site's routes at `route` with a fresh query client (site defaults, no retries). */
export function renderSite(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 } } });
  const router = createMemoryRouter(createRoutesFromElements(routes), { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
