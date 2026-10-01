import type { ReactNode } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { ApiError } from '../../lib/cms';
import { formatDate } from '../../lib/format';
import { useCustomerOrder, useMoney } from '../hooks';
import { PaymentQr } from '../components/PaymentQr';
import { SummaryLines, SummaryTotals } from '../components/Summary';
import type { CustomerOrder, PaymentInstructions } from '../types';

const NOT_FOUND = 'Objednávka nenalezena. Zkontrolujte prosím odkaz.';

function statusText(o: CustomerOrder): string {
  if (o.status === 'CANCELLED') return 'zrušená';
  if (o.status === 'COMPLETED') return 'vyřízená';
  if (o.fulfilmentStatus === 'SHIPPED') return 'odeslaná';
  return o.paymentStatus === 'PAID' ? 'zaplacená' : 'přijatá';
}

const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

function PaymentBox({ instructions }: { instructions: PaymentInstructions }) {
  const money = useMoney();
  return (
    <div className="payment-box">
      <h2>Platba převodem</h2>
      <dl>
        {instructions.accountNumber && (
          <div>
            <dt>Číslo účtu</dt>
            <dd>{instructions.accountNumber}</dd>
          </div>
        )}
        {instructions.iban && (
          <div>
            <dt>IBAN</dt>
            <dd>{formatIban(instructions.iban)}</dd>
          </div>
        )}
        {instructions.bic && (
          <div>
            <dt>BIC</dt>
            <dd>{instructions.bic}</dd>
          </div>
        )}
        <div>
          <dt>Částka</dt>
          <dd>{money(instructions.amount, instructions.currency)}</dd>
        </div>
        <div>
          <dt>Variabilní symbol</dt>
          <dd>{instructions.reference}</dd>
        </div>
        <div>
          <dt>Příjemce</dt>
          <dd>{instructions.holder}</dd>
        </div>
      </dl>
      {instructions.qr && <PaymentQr text={instructions.qr} />}
      <p className="muted">Platbu spárujeme ručně, potvrzení vám přijde e-mailem.</p>
    </div>
  );
}

function StateBlocks({ order }: { order: CustomerOrder }) {
  if (order.status === 'CANCELLED') return <div className="order-state">Objednávka byla zrušena.</div>;
  const blocks: ReactNode[] = [];
  if (order.payment.instructions) blocks.push(<PaymentBox key="pay" instructions={order.payment.instructions} />);
  if (order.payment.method === 'CASH_ON_DELIVERY' && order.fulfilmentStatus === 'UNFULFILLED') {
    blocks.push(
      <div key="cod" className="order-state">
        Zaplatíte při převzetí zásilky.
      </div>,
    );
  }
  if (order.paymentStatus === 'PAID' && order.lines.some((l) => l.type === 'DIGITAL')) {
    blocks.push(
      <div key="downloads" className="order-state">
        Odkazy ke stažení jsme poslali na váš e-mail.
      </div>,
    );
  }
  if (order.fulfilmentStatus === 'SHIPPED' && order.lines.some((l) => l.type === 'PHYSICAL')) {
    blocks.push(
      <div key="shipped" className="order-state">
        <p>Zásilka je na cestě.</p>
        {order.tracking?.number && <p className="mono">{`Číslo zásilky: ${order.tracking.number}`}</p>}
        {order.tracking?.url && (
          <p>
            <a href={order.tracking.url} target="_blank" rel="noreferrer" className="text-link">
              Sledovat zásilku
            </a>
          </p>
        )}
      </div>,
    );
  }
  return <>{blocks}</>;
}

export function OrderPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const location = useLocation();
  const justPlaced = (location.state as { placed?: boolean } | null)?.placed === true;
  const order = useCustomerOrder(number, token);

  let body: ReactNode;
  if (!token) body = <ErrorState message={NOT_FOUND} />;
  else if (order.isLoading) body = <Spinner />;
  else if (order.isError || !order.data) {
    body = <ErrorState message={order.error instanceof ApiError && order.error.status === 404 ? NOT_FOUND : 'Objednávku se nepodařilo načíst.'} />;
  } else {
    const o = order.data;
    body = (
      <>
        <h1>{`Objednávka ${o.number}`}</h1>
        <p className="mono muted">{`Vytvořena ${formatDate(o.createdAt)}, stav: ${statusText(o)}`}</p>
        <StateBlocks order={o} />
        <h2 className="order-items-title">Položky</h2>
        <SummaryLines lines={o.lines} currency={o.currency} />
        <SummaryTotals totals={o.totals} shippingName={o.shipping?.name ?? null} currency={o.currency} />
        <p className="muted">Uložte si odkaz na tuto stránku, vždy na ní uvidíte aktuální stav objednávky.</p>
      </>
    );
  }

  return (
    <section className="article">
      <div className="container">
        <div className="kicker">{justPlaced ? 'děkujeme za objednávku' : 'objednávka'}</div>
        {body}
      </div>
    </section>
  );
}
