interface LogoProps {
  size?: number
}

export function Logo({ size = 32 }: LogoProps) {
  return (
    <span
      aria-hidden
      className="inline-grid shrink-0 place-items-center rounded-lg bg-foreground font-serif font-semibold text-background"
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      T
    </span>
  )
}
