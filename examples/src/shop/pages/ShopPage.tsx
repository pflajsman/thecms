import { Link } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { useMoney, useProducts } from '../hooks';
import { isSoldOut, productImages, productName } from '../product';
import { ProductImage } from '../components/ProductImage';
import type { ShopProduct } from '../types';

export function ShopPage() {
  const products = useProducts();
  const money = useMoney();
  const price = (p: ShopProduct) => {
    if (!p.priceRange) return '';
    const { min, max } = p.priceRange;
    return min === max ? money(min, p.currency) : `od ${money(min, p.currency)}`;
  };

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">obchod</div>
        <h1>Obchod</h1>
        {products.isLoading && <Spinner />}
        {products.isError && <ErrorState message="Obchod se nepodařilo načíst." />}
        {products.data && products.data.length === 0 && <ErrorState message="Zatím tu nic není." />}
        {products.data && products.data.length > 0 && (
          <ul className="product-grid">
            {products.data.map((p) => (
              <li key={p.id}>
                <Link to={`/obchod/${p.id}`} className="product-card">
                  <ProductImage mediaRef={productImages(p)[0]} alt="" />
                  <span className="product-name">{productName(p)}</span>
                  <span className="product-price">{price(p)}</span>
                  {isSoldOut(p) && <span className="badge">vyprodáno</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
