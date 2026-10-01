import { NavLink } from 'react-router-dom';
import { plural } from '../../lib/format';
import { useCart } from '../cart';

export function CartLink() {
  const { count } = useCart();
  const label = count ? `Košík, ${count} ${plural(count, 'položka', 'položky', 'položek')}` : 'Košík, prázdný';
  return (
    <NavLink to="/kosik" className="cart-link" aria-label={label}>
      košík
      {count > 0 && (
        <span className="cart-count" aria-hidden="true">
          {count}
        </span>
      )}
    </NavLink>
  );
}
