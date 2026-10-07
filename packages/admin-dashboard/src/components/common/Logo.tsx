interface LogoProps {
  /** Height of the brace icon in pixels; the wordmark scales with it. */
  size?: number
  /** `full` is the icon with The{CMS}; `mark` is the icon alone, for tight spaces. */
  variant?: 'full' | 'mark'
}

/** Curly braces around a dot: content leaves TheCMS as JSON through its API. */
function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <path
        d="M8 4.5c-2.2 0-2.6 1-2.6 3v2.2c0 1.3-.7 2.1-2 2.3 1.3.2 2 1 2 2.3v2.2c0 2 .4 3 2.6 3M16 4.5c2.2 0 2.6 1 2.6 3v2.2c0 1.3.7 2.1 2 2.3-1.3.2-2 1-2 2.3v2.2c0 2-.4 3-2.6 3"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.1" fill="var(--logo-dot)" />
    </svg>
  )
}

/** The TheCMS logo. Decorative; the surrounding link or heading carries the name. */
export function Logo({ size = 32, variant = 'mark' }: LogoProps) {
  if (variant === 'mark') {
    return (
      <span aria-hidden className="inline-flex">
        <Mark size={size} />
      </span>
    )
  }
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center" style={{ gap: size * 0.32 }}>
      <Mark size={size} />
      <span
        className="whitespace-nowrap font-serif font-semibold leading-none tracking-tight text-foreground"
        style={{ fontSize: size * 0.78 }}
      >
        The<span className="font-sans font-medium text-primary">{'{'}</span>CMS<span className="font-sans font-medium text-primary">{'}'}</span>
      </span>
    </span>
  )
}
