export function ColorClashIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,255,0.6))' }}>
      <circle cx="12" cy="12" r="6" stroke="#00FFFF" strokeWidth="1.5" />
      <path d="M 12 6 A 6 6 0 0 1 12 18" fill="#00FFFF" />
    </svg>
  );
}
