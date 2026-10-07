const LETTERS = ['T', 'h', 'e', 'C', 'M', 'S']

// Each tile is placed a little crooked, like letters cut out and stuck on by hand.
const TILT = [-6, 4, -3, 5, -4, 3]
const LIFT = [0, -0.08, 0.05, -0.04, 0.07, -0.06]

interface LogoProps {
  /** Height of one tile in pixels. */
  size?: number
  /** `full` spells TheCMS; `mark` is the single T tile, for tight spaces. */
  variant?: 'full' | 'mark'
}

function Tile({ letter, index, size }: { letter: string; index: number; size: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center font-hand font-bold leading-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.78,
        color: 'var(--logo-ink)',
        background: `var(--logo-${index + 1})`,
        // Uneven corners keep the tiles from looking machine-cut.
        borderRadius: `${size * 0.22}px ${size * 0.3}px ${size * 0.2}px ${size * 0.28}px`,
        transform: `translateY(${LIFT[index] * size}px) rotate(${TILT[index]}deg)`,
        boxShadow: '0 1px 0 rgb(43 38 32 / 0.18)',
      }}
    >
      <span style={{ transform: 'translateY(-0.04em)' }}>{letter}</span>
    </span>
  )
}

/** The TheCMS logo: its letters on pastel tiles. Decorative; the surrounding link or heading carries the name. */
export function Logo({ size = 32, variant = 'mark' }: LogoProps) {
  const letters = variant === 'full' ? LETTERS : LETTERS.slice(0, 1)
  return (
    <span aria-hidden className="inline-flex shrink-0 items-center" style={{ gap: size * 0.1 }}>
      {letters.map((letter, i) => (
        <Tile key={letter} letter={letter} index={i} size={size} />
      ))}
    </span>
  )
}
