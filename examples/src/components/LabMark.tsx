/** The FlajsmanLab mark: three pastel shapes leaning on each other, like samples on a lab bench. */
export function LabMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="4" y="20" width="22" height="22" rx="7" fill="var(--sun)" />
      <circle cx="31" cy="27" r="13" fill="var(--lilac)" style={{ mixBlendMode: 'multiply' }} />
      <path d="M24 4 L38 26 H10 Z" fill="var(--primary)" opacity="0.9" style={{ mixBlendMode: 'multiply' }} />
    </svg>
  );
}
