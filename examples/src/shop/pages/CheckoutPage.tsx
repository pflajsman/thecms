import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState, Spinner } from '../../components/Spinner';
import { ApiError } from '../../lib/cms';
import { shop } from '../api';
import { useCart } from '../cart';
import {
  FIELD_ORDER,
  PAYMENT_LABEL,
  emptyForm,
  forgetCheckoutKey,
  keyFor,
  markUnanswered,
  orderRequest,
  paymentOptions,
  quoteRequest,
  validateCheckout,
  type CheckoutForm,
  type FieldErrors,
  type FieldKey,
} from '../checkout-form';
import { checkoutProblem, type CheckoutProblem } from '../errors';
import { quoteKey, useCountries, useDebounced, useMoney, useQuote } from '../hooks';
import { SummaryLines, SummaryTotals } from '../components/Summary';
import type { Quote } from '../types';

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(['cs'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

const LOST_ANSWER = 'Předchozí pokus o objednávku mohl projít, jen se nám nevrátila odpověď. Zkontrolujte prosím e-mail, zda vám nepřišlo potvrzení; pokud ne, klikněte znovu a odešleme objednávku se změněnými údaji.';

/** Element ids for focusing the first invalid field. */
const FIELD_ID: Record<FieldKey, string> = {
  email: 'email',
  name: 'name',
  phone: 'phone',
  street: 'street',
  city: 'city',
  postalCode: 'postalCode',
  company: 'company',
  vatId: 'vatId',
  shipName: 'shipName',
  shipStreet: 'shipStreet',
  shipCity: 'shipCity',
  shipPostalCode: 'shipPostalCode',
  shipping: 'shipping-0',
  payment: 'payment-0',
  note: 'note',
  terms: 'terms',
};

interface TextFieldProps {
  id: FieldKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
}

function TextField({ id, label, value, onChange, error, type = 'text', autoComplete, optional = false }: TextFieldProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="optional"> (nepovinné)</span> : <span className="req"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const cart = useCart();
  const money = useMoney();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const countries = useCountries();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<CheckoutProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const request = useMemo(
    () => quoteRequest({ country: form.country, shippingMethodId: form.shippingMethodId, paymentMethod: form.paymentMethod }, cart.items),
    [form.country, form.shippingMethodId, form.paymentMethod, cart.items],
  );
  const debounced = useDebounced(request, 300);
  const quote = useQuote(cart.items.length ? debounced : null);
  const current = quote.data;
  const settled = debounced === request && !quote.isFetching;

  const countryList = useMemo(() => (countries.data && countries.data.length ? countries.data : ['CZ']), [countries.data]);
  useEffect(() => {
    if (!countryList.includes(form.country)) setForm((f) => ({ ...f, country: countryList.includes('CZ') ? 'CZ' : countryList[0] }));
  }, [countryList, form.country]);

  // Keep shipping and payment valid for the current quote: take the first option when the choice no longer fits.
  useEffect(() => {
    if (!current) return;
    const ids = current.hasPhysical ? current.shippingOptions.map((o) => o.id) : [];
    if (!ids.includes(form.shippingMethodId) && (form.shippingMethodId || ids.length)) setForm((f) => ({ ...f, shippingMethodId: ids[0] ?? '' }));
  }, [current, form.shippingMethodId]);
  const payments = paymentOptions(current, form.shippingMethodId);
  useEffect(() => {
    if (!current) return;
    const methods = paymentOptions(current, form.shippingMethodId).map((p) => p.method);
    if (methods.length && !methods.some((m) => m === form.paymentMethod)) setForm((f) => ({ ...f, paymentMethod: methods[0] }));
  }, [current, form.shippingMethodId, form.paymentMethod]);

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setProblem(null);
  };

  const hasLineProblem = current?.lines.some((l) => l.problem) ?? false;
  const noShipping = !!current && current.hasPhysical && current.shippingOptions.length === 0;
  // Shipping and payment are picked automatically right after a quote arrives; wait for them so the button does not flicker.
  const choicesReady = !!current && (!current.hasPhysical || !!form.shippingMethodId) && !!form.paymentMethod;
  const canOrder = !!current && settled && choicesReady && !hasLineProblem && !noShipping && !submitting;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !current || !canOrder) return;
    const found = validateCheckout(form, { hasPhysical: current.hasPhysical });
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    const body = orderRequest(form, cart.items, current);
    const { key, afterLostAnswer } = keyFor(body);
    if (afterLostAnswer) {
      setProblem({ section: 'form', text: LOST_ANSWER });
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const placed = await shop.placeOrder(body, key);
      forgetCheckoutKey();
      cart.clear();
      navigate(`/objednavka/${placed.number}?t=${encodeURIComponent(placed.accessToken)}`, { replace: true, state: { placed: true } });
    } catch (error) {
      const found = checkoutProblem(error);
      if (error instanceof ApiError) {
        // The answer carries fresh prices and stock: show them, and refresh every other quote (the cart's too).
        if (error.body.quote) queryClient.setQueryData(quoteKey(debounced), error.body.quote as Quote);
        void queryClient.invalidateQueries({ queryKey: ['shop', 'quote'], refetchType: 'none' });
      } else {
        markUnanswered();
      }
      if (found.retryWithNewKey) forgetCheckoutKey();
      if (found.fields) {
        setErrors(found.fields);
        const first = FIELD_ORDER.find((k) => found.fields?.[k]);
        if (first) document.getElementById(FIELD_ID[first])?.focus();
      }
      setProblem(found);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <section className="article">
        <div className="container">
          <div className="kicker">pokladna</div>
          <ErrorState message="Košík je prázdný." />
          <p>
            <Link to="/obchod" className="btn">
              Do obchodu
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const physical = current?.hasPhysical ?? false;
  const sectionError = (section: CheckoutProblem['section']) =>
    problem?.section === section ? (
      <p className="field-error" role="alert">
        {problem.text}
      </p>
    ) : null;

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">pokladna</div>
        <h1>Pokladna</h1>
        <form className="checkout" noValidate onSubmit={(e) => void submit(e)}>
          {/* Locked while the order is being sent, so what was clicked is what gets ordered. */}
          <fieldset className="checkout-main" disabled={submitting}>
            <fieldset className="checkout-section">
              <legend>1. Kontakt</legend>
              <TextField id="email" type="email" autoComplete="email" label="E-mail" value={form.email} onChange={(v) => set('email', v)} error={errors.email} />
              <TextField id="name" autoComplete="name" label="Jméno a příjmení" value={form.name} onChange={(v) => set('name', v)} error={errors.name} />
              <TextField id="phone" type="tel" autoComplete="tel" label="Telefon" optional value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone} />
            </fieldset>

            <fieldset className="checkout-section">
              <legend>2. Adresa</legend>
              <div className="form-group">
                <label htmlFor="country">
                  Země<span className="req"> *</span>
                </label>
                <select id="country" autoComplete="country" value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {countryList.map((code) => (
                    <option key={code} value={code}>
                      {countryName(code)}
                    </option>
                  ))}
                </select>
              </div>
              <TextField id="street" autoComplete="street-address" label="Ulice a číslo popisné" value={form.street} onChange={(v) => set('street', v)} error={errors.street} />
              <TextField id="city" autoComplete="address-level2" label="Město" value={form.city} onChange={(v) => set('city', v)} error={errors.city} />
              <TextField id="postalCode" autoComplete="postal-code" label="PSČ" value={form.postalCode} onChange={(v) => set('postalCode', v)} error={errors.postalCode} />
              <div className="form-group checkbox-row">
                <input id="isCompany" type="checkbox" checked={form.isCompany} onChange={(e) => set('isCompany', e.target.checked)} />
                <label htmlFor="isCompany">Nakupuji na firmu</label>
              </div>
              {form.isCompany && (
                <>
                  <TextField id="company" autoComplete="organization" label="Název firmy" value={form.company} onChange={(v) => set('company', v)} error={errors.company} />
                  <TextField id="vatId" label="DIČ" optional value={form.vatId} onChange={(v) => set('vatId', v)} error={errors.vatId} />
                </>
              )}
              {physical && (
                <div className="form-group checkbox-row">
                  <input id="shipElsewhere" type="checkbox" checked={form.shipElsewhere} onChange={(e) => set('shipElsewhere', e.target.checked)} />
                  <label htmlFor="shipElsewhere">Doručit na jinou adresu</label>
                </div>
              )}
              {physical && form.shipElsewhere && (
                <>
                  <TextField id="shipName" autoComplete="shipping name" label="Jméno příjemce" value={form.shipName} onChange={(v) => set('shipName', v)} error={errors.shipName} />
                  <TextField id="shipStreet" autoComplete="shipping street-address" label="Ulice a číslo popisné (doručení)" value={form.shipStreet} onChange={(v) => set('shipStreet', v)} error={errors.shipStreet} />
                  <TextField id="shipCity" autoComplete="shipping address-level2" label="Město (doručení)" value={form.shipCity} onChange={(v) => set('shipCity', v)} error={errors.shipCity} />
                  <TextField id="shipPostalCode" autoComplete="shipping postal-code" label="PSČ (doručení)" value={form.shipPostalCode} onChange={(v) => set('shipPostalCode', v)} error={errors.shipPostalCode} />
                </>
              )}
            </fieldset>

            {physical && current && (
              <fieldset className="checkout-section">
                <legend>3. Doprava</legend>
                {noShipping ? (
                  <p className="field-error">Do této země bohužel nedoručujeme.</p>
                ) : (
                  current.shippingOptions.map((o, i) => (
                    <label key={o.id} className="choice">
                      <input id={`shipping-${i}`} type="radio" name="shipping" checked={form.shippingMethodId === o.id} onChange={() => set('shippingMethodId', o.id)} />
                      <span>{o.name}</span>
                      <span className="choice-price">{o.price ? money(o.price, current.currency) : 'zdarma'}</span>
                    </label>
                  ))
                )}
                {errors.shipping && <p className="field-error">{errors.shipping}</p>}
                {sectionError('shipping')}
              </fieldset>
            )}

            <fieldset className="checkout-section">
              <legend>{physical ? '4. Platba' : '3. Platba'}</legend>
              {current &&
                payments.map((p, i) => (
                  <label key={p.method} className="choice">
                    <input id={`payment-${i}`} type="radio" name="payment" checked={form.paymentMethod === p.method} onChange={() => set('paymentMethod', p.method)} />
                    <span>{PAYMENT_LABEL[p.method]}</span>
                    {p.fee > 0 && <span className="choice-price">{`+${money(p.fee, current.currency)}`}</span>}
                  </label>
                ))}
              {errors.payment && <p className="field-error">{errors.payment}</p>}
              {sectionError('payment')}
            </fieldset>

            <div className="form-group">
              <label htmlFor="note">
                Poznámka pro prodejce<span className="optional"> (nepovinné)</span>
              </label>
              <textarea
                id="note"
                value={form.note}
                maxLength={1000}
                onChange={(e) => set('note', e.target.value)}
                aria-invalid={errors.note ? true : undefined}
                aria-describedby={errors.note ? 'note-error' : undefined}
              />
              {errors.note && (
                <p id="note-error" className="field-error">
                  {errors.note}
                </p>
              )}
            </div>
          </fieldset>

          <aside className="checkout-summary" aria-labelledby="summary-title">
            <h2 id="summary-title">Souhrn</h2>
            {current ? (
              <>
                <SummaryLines lines={current.lines} currency={current.currency} />
                <SummaryTotals totals={current.totals} shippingName={current.shipping?.name ?? null} currency={current.currency} />
              </>
            ) : quote.isError ? (
              <p className="field-error">Ceny se nepodařilo načíst.</p>
            ) : (
              <Spinner />
            )}
            {hasLineProblem && (
              <p className="field-error">
                Některé zboží v košíku je potřeba upravit.{' '}
                <Link to="/kosik" className="text-link">
                  Upravit košík
                </Link>
              </p>
            )}
            <div className="form-group checkbox-row terms">
              <input
                id="terms"
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => set('acceptTerms', e.target.checked)}
                aria-invalid={errors.terms ? true : undefined}
                aria-describedby={errors.terms ? 'terms-error' : undefined}
              />
              <label htmlFor="terms">
                Souhlasím s{' '}
                <Link to="/obchodni-podminky" target="_blank" className="text-link">
                  obchodními podmínkami
                </Link>
              </label>
            </div>
            {errors.terms && (
              <p id="terms-error" className="field-error">
                {errors.terms}
              </p>
            )}
            {sectionError('terms')}
            {problem && (problem.section === 'form' || problem.section === 'cart') && (
              <div className="banner-error" role="alert">
                {problem.text}
                {problem.section === 'cart' && (
                  <>
                    {' '}
                    <Link to="/kosik" className="text-link">
                      Upravit košík
                    </Link>
                  </>
                )}
              </div>
            )}
            <button type="submit" className="btn btn-block" disabled={!canOrder}>
              Objednat s povinností platby
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
}
