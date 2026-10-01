import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { CartProvider } from '../shop/cart';

/** Renders routes with a fresh query client (site defaults, no retries) and a cart read from localStorage. */
export function renderRoutes(routes: RouteObject[], route: string) {
  // The site's defaults (src/lib/queryClient.ts) without retries, so caching behaves as in production.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000 } } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
