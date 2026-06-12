import { useState, type FormEvent } from 'react';
import { useContactForm } from '../hooks/usePosts';
import { cms } from '../lib/cms';
import { Spinner, ErrorState } from '../components/Spinner';
import type { FormField } from '../types';

function Field({ field }: { field: FormField }) {
  const req = field.required ? <span className="req"> *</span> : null;
  const common = { name: field.name, required: field.required, placeholder: field.placeholder };

  if (field.type === 'TEXTAREA') {
    return (
      <div className="form-group">
        <label>
          {field.label}
          {req}
        </label>
        <textarea {...common} />
      </div>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <div className="form-group">
        <label>
          {field.label}
          {req}
        </label>
        <select name={field.name} required={field.required} defaultValue="">
          <option value="">Vyber…</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'CHECKBOX') {
    return (
      <div className="form-group">
        <div className="checkbox-row">
          <input type="checkbox" name={field.name} required={field.required} />
          <label style={{ margin: 0 }}>
            {field.label}
            {req}
          </label>
        </div>
      </div>
    );
  }

  const type =
    field.type === 'EMAIL' ? 'email' : field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text';

  return (
    <div className="form-group">
      <label>
        {field.label}
        {req}
      </label>
      <input type={type} {...common} />
    </div>
  );
}

export function Contact() {
  const { data: form, isLoading, isError, error } = useContactForm();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setSubmitError(null);

    const formEl = e.currentTarget;
    const values: Record<string, unknown> = {};
    for (const field of form.fields) {
      const el = formEl.elements.namedItem(field.name) as HTMLInputElement | null;
      if (!el) continue;
      values[field.name] = field.type === 'CHECKBOX' ? el.checked : el.value;
    }

    try {
      await cms.submitContactForm(values);
      setSuccess(true);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="article">
      <div className="container">
        <div className="kicker">kontakt</div>
        <h1>{form?.name || 'Napiš mi'}</h1>
        {form?.description && (
          <p style={{ color: 'var(--muted)', marginTop: 12, marginBottom: 8 }}>{form.description}</p>
        )}

        {isLoading && <Spinner />}
        {isError && <ErrorState message={(error as Error)?.message || 'Formulář se nepodařilo načíst.'} />}

        {success && (
          <div className="form-success" style={{ marginTop: 24 }}>
            <h2>Díky!</h2>
            <p className="mono">Zpráva byla odeslána.</p>
            <button className="btn" style={{ marginTop: 20 }} onClick={() => setSuccess(false)}>
              Poslat další
            </button>
          </div>
        )}

        {form && !success && (
          <form className="form" style={{ marginTop: 24 }} onSubmit={onSubmit}>
            {submitError && <div className="banner-error">{submitError}</div>}
            {form.fields.map((field) => (
              <Field key={field.name} field={field} />
            ))}
            <button type="submit" className="btn btn-block" disabled={submitting}>
              {submitting ? 'Odesílám…' : 'Odeslat'}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
