import { useLang } from '../i18n';

export function Spinner() {
  const { t } = useLang();
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <p>{t.loading}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state" role="alert">
      <p>{message}</p>
    </div>
  );
}
