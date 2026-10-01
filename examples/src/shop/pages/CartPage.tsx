import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { useCart } from '../cart';
import { useMoney, useQuote } from '../hooks';
import type { QuoteLine } from '../types';

function ProblemNote({ line, onReduce }: { line: QuoteLine; onReduce: (quantity: number) => void }) {
  if (line.problem === 'NOT_ENOUGH_STOCK' && line.availableQuantity) {
    const available = line.availableQuantity;
    return (
      <p className="line-problem">
        {`Skladem jen ${available} ks.`}{' '}
        <button type="button" className="text-link" onClick={() => onReduce(available)}>
          {`Snížit na ${available}`}
        </button>
      </p>
    );
  }
  if (line.problem === 'OUT_OF_STOCK' || line.problem === 'NOT_ENOUGH_STOCK') return <p className="line-problem">Vyprodáno</p>;
  return <p className="line-problem">Už není v prodeji</p>;
}

export function CartPage() {
  const cart = useCart();
  const money = useMoney();
  const request = useMemo(
    () => (cart.items.length ? { items: cart.items.map(({ variantId, quantity }) => ({ variantId, quantity })) } : null),
    [cart.items],
  );
  const quote = useQuote(request);
  const hasProblem = quote.data?.lines.some((l) => l.problem) ?? false;

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">košík</div>
        <h1>Košík</h1>
        {cart.items.length === 0 && (
          <>
            <ErrorState message="Košík je prázdný." />
            <p>
              <Link to="/obchod" className="btn">
                Do obchodu
              </Link>
            </p>
          </>
        )}
        {cart.items.length > 0 && quote.isLoading && <Spinner />}
        {cart.items.length > 0 && quote.isError && !quote.data && (
          <>
            <ErrorState message="Košík se nepodařilo načíst." />
            <button type="button" className="btn" onClick={() => void quote.refetch()}>
              Zkusit znovu
            </button>
          </>
        )}
        {cart.items.length > 0 && quote.data && (
          <>
            <ul className="cart-lines">
              {cart.items.map((item) => {
                const line = quote.data.lines.find((l) => l.variantId === item.variantId);
                const name = line?.name || 'Neznámé zboží';
                return (
                  <li key={item.variantId} className="cart-line">
                    <div className="cart-line-main">
                      <Link to={`/obchod/${item.productId}`} className="cart-line-name">
                        {name}
                      </Link>
                      {line && line.optionLabels.length > 0 && <span className="muted">{line.optionLabels.map((o) => `${o.option}: ${o.value}`).join(', ')}</span>}
                      {line?.problem && <ProblemNote line={line} onReduce={(n) => cart.setQuantity(item.variantId, n)} />}
                    </div>
                    <div className="cart-line-qty">
                      <button type="button" aria-label={`Ubrat kus: ${name}`} disabled={item.quantity <= 1} onClick={() => cart.setQuantity(item.variantId, item.quantity - 1)}>
                        −
                      </button>
                      <span aria-label={`Počet kusů: ${name}`}>{item.quantity}</span>
                      <button type="button" aria-label={`Přidat kus: ${name}`} disabled={item.quantity >= 99} onClick={() => cart.setQuantity(item.variantId, item.quantity + 1)}>
                        +
                      </button>
                    </div>
                    <div className="cart-line-total">{line && !line.problem ? money(line.lineTotal, quote.data.currency) : ''}</div>
                    <button type="button" className="text-link cart-remove" aria-label={`Odebrat ${name}`} onClick={() => cart.remove(item.variantId)}>
                      Odebrat
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="cart-footer">
              <p className="cart-subtotal">
                <span>Mezisoučet</span> <strong>{money(quote.data.totals.items, quote.data.currency)}</strong>
              </p>
              <p className="muted">Dopravu a platbu vyberete v pokladně.</p>
              {hasProblem && (
                <p className="line-problem" role="alert">
                  Než budete pokračovat, upravte prosím označené položky.
                </p>
              )}
              {hasProblem ? (
                <button type="button" className="btn" disabled>
                  K pokladně
                </button>
              ) : (
                <Link to="/pokladna" className="btn">
                  K pokladně
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
