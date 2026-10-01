import { useMoney } from '../hooks';
import type { OptionLabel, Totals } from '../types';

interface SummaryLine {
  name: string;
  optionLabels: OptionLabel[];
  quantity: number;
  lineTotal: number;
}

export function SummaryLines({ lines, currency }: { lines: SummaryLine[]; currency: string }) {
  const money = useMoney();
  return (
    <ul className="summary-lines">
      {lines.map((l, i) => (
        <li key={i}>
          <span className="summary-name">{`${l.quantity} × ${l.name}${l.optionLabels.length ? ` (${l.optionLabels.map((o) => o.value).join(', ')})` : ''}`}</span>
          <span>{money(l.lineTotal, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SummaryTotals({ totals, shippingName, currency }: { totals: Totals; shippingName: string | null; currency: string }) {
  const money = useMoney();
  const vat = totals.vat.map((v) => `${(v.rate / 100).toLocaleString('cs-CZ')} % ${money(v.amount, currency)}`).join(', ');
  return (
    <>
      <dl className="summary-totals">
        <div>
          <dt>Zboží</dt>
          <dd>{money(totals.items, currency)}</dd>
        </div>
        {shippingName && (
          <div>
            <dt>{`Doprava (${shippingName})`}</dt>
            <dd>{totals.shipping ? money(totals.shipping, currency) : 'zdarma'}</dd>
          </div>
        )}
        {totals.paymentFee > 0 && (
          <div>
            <dt>Poplatek za platbu</dt>
            <dd>{money(totals.paymentFee, currency)}</dd>
          </div>
        )}
        <div className="summary-total">
          <dt>Celkem</dt>
          <dd>{money(totals.total, currency)}</dd>
        </div>
      </dl>
      {vat && <p className="muted vat-note">{`Včetně DPH ${vat}`}</p>}
    </>
  );
}
