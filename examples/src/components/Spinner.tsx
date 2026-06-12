export function Spinner({ label = 'Načítám…' }: { label?: string }) {
  return (
    <div className="state">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="state">
      <p>{message}</p>
    </div>
  );
}
