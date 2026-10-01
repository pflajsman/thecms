import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { RichText } from '../../components/RichText';
import { ApiError } from '../../lib/cms';
import { useCart } from '../cart';
import { useMoney, useProduct } from '../hooks';
import { findVariant, initialChoice, maxQuantity, productDescription, productImages, productName } from '../product';
import { ProductImage } from '../components/ProductImage';
import type { ShopProduct, ShopVariant } from '../types';

export function ProductPage() {
  const { id } = useParams();
  const product = useProduct(id);

  if (product.isLoading) {
    return (
      <section className="article">
        <div className="container">
          <Spinner />
        </div>
      </section>
    );
  }
  if (product.isError || !product.data) {
    const missing = product.error instanceof ApiError && product.error.status === 404;
    return (
      <section className="article">
        <div className="container">
          <Link to="/obchod" className="back">
            ← obchod
          </Link>
          <ErrorState message={missing ? 'Produkt nenalezen.' : 'Produkt se nepodařilo načíst.'} />
        </div>
      </section>
    );
  }
  return <ProductDetail key={product.data.id} product={product.data} />;
}

function availability(product: ShopProduct, variant: ShopVariant | undefined): string {
  if (!variant) return 'Tato kombinace není v nabídce.';
  if (!variant.available) return 'Vyprodáno';
  if (product.type === 'DIGITAL') return 'Ke stažení po zaplacení';
  if (variant.availableQuantity !== null && variant.availableQuantity <= 5) return `Skladem posledních ${variant.availableQuantity} ks`;
  return 'Skladem';
}

function ProductDetail({ product }: { product: ShopProduct }) {
  const cart = useCart();
  const money = useMoney();
  const [chosen, setChosen] = useState(() => initialChoice(product));
  const [quantity, setQuantity] = useState('1');
  const [image, setImage] = useState(0);
  const [status, setStatus] = useState<'added' | 'full' | null>(null);

  const variant = findVariant(product, chosen);
  const images = productImages(product);
  const name = productName(product);
  const description = productDescription(product);
  const max = variant ? maxQuantity(variant) : 0;
  const pieces = Number(quantity);
  const quantityOk = Number.isInteger(pieces) && pieces >= 1 && pieces <= max;
  const canAdd = !!variant && variant.available && quantityOk;

  const add = () => {
    if (!variant || !canAdd) return;
    setStatus(cart.add({ variantId: variant.id, productId: product.id, quantity: pieces }) ? 'added' : 'full');
  };

  return (
    <section className="article">
      <div className="container-wide">
        <Link to="/obchod" className="back">
          ← obchod
        </Link>
        <div className="product-layout">
          <div className="product-gallery">
            <ProductImage mediaRef={images[image]} alt={name} className="large" />
            {images.length > 1 && (
              <div className="product-thumbs">
                {images.map((ref, i) => (
                  <button key={ref} type="button" className={i === image ? 'is-active' : ''} aria-label={`Obrázek ${i + 1}`} aria-pressed={i === image} onClick={() => setImage(i)}>
                    <ProductImage mediaRef={ref} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="product-info">
            <h1>{name}</h1>
            <p className="product-price">{variant ? money(variant.price, product.currency) : ''}</p>
            {product.options.map((o) => (
              <fieldset key={o.key} className="option-group">
                <legend>{o.label}</legend>
                <div className="option-values">
                  {o.values.map((v) => (
                    <label key={v.key} className={`option-chip ${chosen[o.key] === v.key ? 'is-active' : ''}`}>
                      <input
                        type="radio"
                        name={`option-${o.key}`}
                        value={v.key}
                        checked={chosen[o.key] === v.key}
                        onChange={() => {
                          setChosen({ ...chosen, [o.key]: v.key });
                          setStatus(null);
                        }}
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="availability">{availability(product, variant)}</p>
            {variant?.available && (
              <div className="form-group quantity">
                <label htmlFor="quantity">Počet</label>
                <input
                  id="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setStatus(null);
                  }}
                  aria-invalid={quantityOk ? undefined : true}
                  aria-describedby={quantityOk ? undefined : 'quantity-error'}
                />
                {!quantityOk && (
                  <p id="quantity-error" className="field-error">
                    {`Zadejte počet od 1 do ${max}.`}
                  </p>
                )}
              </div>
            )}
            <button type="button" className="btn" disabled={!canAdd} onClick={add}>
              Do košíku
            </button>
            <p role="status" className="add-status">
              {status === 'added' && (
                <>
                  Přidáno do košíku.{' '}
                  <Link to="/kosik" className="text-link">
                    Zobrazit košík
                  </Link>
                </>
              )}
              {status === 'full' && 'Košík je plný, může obsahovat nejvýše 50 různých položek.'}
            </p>
            {description && (
              <div className="product-description">
                <RichText html={description} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
