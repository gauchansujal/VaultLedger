export function VaultMark({ className }: { className?: string }) {
  return (
    <svg
      width="56"
      height="56"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <circle cx="28" cy="28" r="26" stroke="#2A3339" strokeWidth="2" />
      <circle cx="28" cy="28" r="19" stroke="#C9A227" strokeWidth="1.5" />
      {/* Dial ticks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * 30 * Math.PI) / 180;
        const x1 = 28 + 22 * Math.sin(angle);
        const y1 = 28 - 22 * Math.cos(angle);
        const x2 = 28 + 25 * Math.sin(angle);
        const y2 = 28 - 25 * Math.cos(angle);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#8B95A1"
            strokeWidth={i % 3 === 0 ? 1.5 : 0.75}
          />
        );
      })}
      {/* Dial pointer */}
      <line x1="28" y1="28" x2="28" y2="14" stroke="#C9A227" strokeWidth="2" strokeLinecap="round" />
      <circle cx="28" cy="28" r="2.5" fill="#C9A227" />
    </svg>
  );
}
