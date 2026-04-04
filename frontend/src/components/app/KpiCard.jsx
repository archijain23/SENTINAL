/**
 * KpiCard — single metric tile for the dashboard top row.
 * Props:
 *   label    {string}  — metric name
 *   value    {string}  — formatted value to display
 *   trend    {string}  — trend string e.g. "+12%" or "-2"
 *   trendUp  {boolean} — true = positive direction
 *   accent   {string}  — hex color for the glow/icon
 *   icon     {ReactNode}
 */
export default function KpiCard({ label, value, trend, trendUp, accent, icon }) {
  const trendColor = trendUp ? '#00FF88' : '#FF3D71';

  return (
    <article
      className="relative rounded-lg p-5 flex flex-col gap-3 overflow-hidden"
      style={{
        background: '#0D1117',
        border: `1px solid rgba(${hexToRgb(accent)},0.15)`,
        boxShadow: `0 2px 16px rgba(${hexToRgb(accent)},0.06)`,
      }}
    >
      {/* Ambient corner glow */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, right: 0,
          width: '80px', height: '80px',
          background: `radial-gradient(circle at top right, rgba(${hexToRgb(accent)},0.12), transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Icon + label */}
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-mono tracking-widest uppercase" style={{ color: '#6B7894' }}>
          {label}
        </p>
        <span
          className="w-7 h-7 rounded flex items-center justify-center shrink-0"
          style={{ background: `rgba(${hexToRgb(accent)},0.1)`, color: accent }}
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      {/* Value */}
      <p
        className="text-2xl font-display font-bold tabular-nums leading-none"
        style={{ color: '#E2E8F0' }}
      >
        {value}
      </p>

      {/* Trend */}
      <div className="flex items-center gap-1.5">
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          aria-hidden="true"
          style={{ transform: trendUp ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
        >
          <path d="M5 8V2M2 5l3-3 3 3" stroke={trendColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-[10px] font-mono tabular-nums" style={{ color: trendColor }}>
          {trend}
        </span>
        <span className="text-[9px] font-mono" style={{ color: '#3D4663' }}>vs yesterday</span>
      </div>
    </article>
  );
}

// Utility: convert hex to "r,g,b" string for rgba()
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3
    ? h.split('').map(c => c+c).join('')
    : h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
