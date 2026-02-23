export function AppLogo({ className }: { className?: string }) {
  return (
    <span className={`font-bold text-2xl tracking-tight ${className ?? ''}`}>
      app
      <span style={{ color: '#86efac' }}>where</span>
      <span style={{ color: '#86efac' }}>?</span>
    </span>
  );
}
