/**
 * Architectural motif: a twisted ribbon of thin slats sweeping across the
 * frame, drawn procedurally (original artwork, not a third-party asset).
 * Purely decorative (aria-hidden) and drawn with currentColor. Use sparingly:
 * empty / loading / error states.
 */
const SLATS = 150;

const RIBBON = Array.from({ length: SLATS }, (_, index) => {
  const t = index / (SLATS - 1);
  const x = 40 + t * 920;
  const y = 330 + Math.sin(t * Math.PI * 1.6 + 0.4) * 150;
  const twist = t * Math.PI * 2.4;
  const half = 18 + Math.abs(Math.cos(twist)) * 120;
  const angle = Math.PI / 2.6 + Math.sin(twist) * 0.45;
  const dx = Math.cos(angle) * half;
  const dy = Math.sin(angle) * half;
  return `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}`;
});

export function FluidLines({ className = '' }: { className?: string }) {
  return (
    <svg className={`fluid-lines ${className}`} viewBox="0 0 1000 660" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {RIBBON.map((d, index) => (
        <path key={index} d={d} style={{ '--i': index } as React.CSSProperties} />
      ))}
    </svg>
  );
}

/** Product mark: three stacked strata. */
export function StrataMark({ size = 20 }: { size?: number }) {
  return (
    <svg className="strata-mark" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2 6.5c3-2 5-2 8 0s5 2 8 0" />
      <path d="M2 11c3-2 5-2 8 0s5 2 8 0" />
      <path d="M2 15.5c3-2 5-2 8 0s5 2 8 0" />
    </svg>
  );
}
