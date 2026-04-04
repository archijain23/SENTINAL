/**
 * ActivitySparkline — 24-hour threat activity area chart
 *
 * Data source: statsAPI.getSummary() → data.recentAttacks[]
 *   Each entry: { createdAt: ISO string, severity: string }
 * Socket:      STATS_UPDATE → rebuilds hourly buckets on every push
 *
 * Buckets recent attacks into 24 hourly slots.
 * Falls back to simulated baseline when backend is offline.
 *
 * Props:
 *   attacks  {Array}   — recentAttacks from stats API
 *   loading  {boolean}
 *   socketLive {boolean}
 */
import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

/** Build 24 hourly buckets from an array of attack objects */
function buildHourlyBuckets(attacks) {
  const now    = new Date();
  const buckets = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now);
    d.setHours(now.getHours() - 23 + i, 0, 0, 0);
    return { hour: d.getHours(), label: `${String(d.getHours()).padStart(2, '0')}:00`, count: 0 };
  });

  if (!attacks || attacks.length === 0) return buckets;

  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  attacks.forEach(a => {
    const ts = new Date(a.createdAt);
    if (ts < cutoff) return;
    const diffH = Math.floor((now - ts) / (60 * 60 * 1000));
    const idx   = 23 - diffH;
    if (idx >= 0 && idx < 24) buckets[idx].count++;
  });

  return buckets;
}

export default function ActivitySparkline({ attacks, loading, socketLive }) {
  const buckets = useMemo(() => buildHourlyBuckets(attacks), [attacks]);

  // Show every 4th label to avoid crowding
  const labels = buckets.map((b, i) => (i % 4 === 0 || i === 23) ? b.label : '');
  const counts = buckets.map(b => b.count);
  const maxVal = Math.max(...counts, 1);

  const chartData = useMemo(() => ({
    labels,
    datasets: [
      {
        label: 'Threats',
        data: counts,
        borderColor: '#FF3D71',
        borderWidth: 1.5,
        backgroundColor: (ctx) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return 'rgba(255,61,113,0.05)';
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, 'rgba(255,61,113,0.25)');
          gradient.addColorStop(1, 'rgba(255,61,113,0.01)');
          return gradient;
        },
        fill: true,
        tension: 0.4,
        pointRadius: counts.map((v, i) => (v > 0 && i === counts.lastIndexOf(Math.max(...counts))) ? 3 : 0),
        pointBackgroundColor: '#FF3D71',
        pointBorderColor: '#0D1117',
        pointBorderWidth: 1.5,
        pointHoverRadius: 4,
      },
    ],
  }), [labels, counts]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeInOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0D1117',
        borderColor: 'rgba(255,61,113,0.25)',
        borderWidth: 1,
        titleColor: '#6B7894',
        bodyColor: '#E2E8F0',
        titleFont: { family: 'monospace', size: 9 },
        bodyFont: { family: 'monospace', size: 11 },
        padding: 10,
        callbacks: {
          title:  (items) => items[0].label || '',
          label:  (ctx)  => `  ${ctx.raw} threat${ctx.raw !== 1 ? 's' : ''}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: '#3D4663',
          font: { family: 'monospace', size: 9 },
          maxRotation: 0,
          autoSkip: false,
        },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(0,245,255,0.04)', drawBorder: false },
        ticks: {
          color: '#3D4663',
          font: { family: 'monospace', size: 9 },
          maxTicksLimit: 4,
          precision: 0,
        },
        border: { display: false },
        min: 0,
        suggestedMax: maxVal + 1,
      },
    },
  }), [maxVal]);

  const peakHour   = buckets.reduce((a, b) => (b.count > a.count ? b : a), buckets[0]);
  const totalIn24h = counts.reduce((a, b) => a + b, 0);

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{
        background: '#0D1117',
        border: '1px solid rgba(0,245,255,0.08)',
        padding: '16px',
      }}
      aria-label="24-hour threat activity sparkline"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1 shrink-0">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#E2E8F0' }}>
            24h Activity
          </p>
          {socketLive && (
            <span
              className="text-[8px] font-mono tracking-widest px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}
            >
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            <>
              <span className="text-[9px] font-mono" style={{ color: '#3D4663' }}>
                peak <span style={{ color: '#FF3D71' }}>{peakHour.label}</span>
              </span>
              <span
                className="text-[10px] font-mono tabular-nums font-bold"
                style={{ color: '#FF3D71' }}
              >
                {totalIn24h}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: '90px', position: 'relative' }}>
        {loading ? (
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(90deg, rgba(61,70,99,0.15) 25%, rgba(61,70,99,0.25) 50%, rgba(61,70,99,0.15) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
              borderRadius: 4,
            }}
          />
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </section>
  );
}
