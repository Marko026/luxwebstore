/** The Luxwebstore logotype: one SVG, so it scales to any width without overflowing. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 32" role="img" aria-label="Luxwebstore" className={className}>
      <text
        x="0"
        y="25"
        textLength="260"
        lengthAdjust="spacing"
        fill="currentColor"
        fontSize="28"
        fontWeight={500}
        className="font-display"
      >
        LUXWEBSTORE
      </text>
    </svg>
  );
}
