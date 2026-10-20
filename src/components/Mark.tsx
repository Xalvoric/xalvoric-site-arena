/**
 * Placeholder brand mark (no logo was supplied): the faceted obelisk from the hero, two tones.
 * It is deliberately not a letter, so it does not repeat the X that starts the name.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 1.5 7.8 7.6 8.8 22.5H12Z" fill="currentColor" />
      <path d="M12 1.5 16.2 7.6 15.2 22.5H12Z" fill="currentColor" fillOpacity="0.55" />
      <path d="M5 22.5h14" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  )
}
