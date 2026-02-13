interface LogoProps {
  size?: number;
  light?: boolean;
}

export function Logo({ size = 36, light = false }: LogoProps) {
  const fg = light ? '#ffffff' : '#000000';
  const bg = light ? '#ffffff' : '#000000';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="36" rx="8" fill={bg} fillOpacity={light ? 0.15 : 1} />
      <text
        x="18"
        y="24"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontWeight="800"
        fontSize="16"
        fill={fg}
        letterSpacing="-0.5"
      >
        CMS
      </text>
    </svg>
  );
}
