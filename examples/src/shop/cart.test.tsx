import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CART_KEY, CartProvider, MAX_LINES, readCart, useCart, withAdded, withQuantity, without } from './cart';
import { CartLink } from './components/CartLink';

const item = (variantId: string, quantity = 1) => ({ variantId, productId: 'p1', quantity });

it('merges a repeated variant and keeps quantities within 1 to 99', () => {
  expect(withAdded([item('a', 2)], item('a', 3))).toEqual([item('a', 5)]);
  expect(withAdded([item('a', 98)], item('a', 5))).toEqual([item('a', 99)]);
  expect(withQuantity([item('a', 2)], 'a', 0)).toEqual([item('a', 1)]);
  expect(without([item('a'), item('b')], 'a')).toEqual([item('b')]);
});

it('refuses a 51st line', () => {
  const full = Array.from({ length: MAX_LINES }, (_, i) => item(`v${i}`));
  expect(withAdded(full, item('extra'))).toBe(full);
});

it('starts empty from broken or foreign storage and drops bad lines', () => {
  expect(readCart('{oops')).toEqual([]);
  expect(readCart('{"a":1}')).toEqual([]);
  expect(readCart(null)).toEqual([]);
  expect(readCart(JSON.stringify([item('a', 500), { variantId: 'b' }, item('c', 0)]))).toEqual([item('a', 99), item('c', 1)]);
});

function Probe() {
  const cart = useCart();
  return (
    <>
      <MemoryRouter>
        <CartLink />
      </MemoryRouter>
      <button onClick={() => cart.add(item('a', 2))}>add</button>
    </>
  );
}

it('saves the cart, shows the count and follows changes from another tab', async () => {
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  expect(screen.getByRole('link', { name: 'Košík, prázdný' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'add' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([item('a', 2)]);
  expect(screen.getByRole('link', { name: 'Košík, 2 položky' })).toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: CART_KEY, newValue: JSON.stringify([item('a', 2), item('b', 3)]) }));
  });
  expect(screen.getByRole('link', { name: 'Košík, 5 položek' })).toBeInTheDocument();
});

it('reads a cart saved earlier', () => {
  localStorage.setItem(CART_KEY, JSON.stringify([item('a', 1)]));
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  expect(screen.getByRole('link', { name: 'Košík, 1 položka' })).toBeInTheDocument();
});
