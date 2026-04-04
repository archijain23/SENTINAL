/**
 * AttackTypeChart — Doughnut chart
 *
 * Data source: statsAPI.getSummary() → data.attacksByType  { [type]: count }
 * Socket:      STATS_UPDATE → data.attacksByType (live updates)
 *
 * Props:
 *   data     {Object}  — { 'SQL Injection': 12, 'Brute Force': 8, ... }
 *   loading  {boolean}
 */
import { useMemo, useRef, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

// Cybersecurity-themed palette — ordered by typical threat frequency
const PALETTE = [
  '#FF3D71', // SQL Injection     — critical red
  '#FF8C00', // Brute Force       — orange
  '#FFB800', // Port Scan         — amber
  '#00F5FF', // XSS               — cyan
  '#7B61FF', // DDoS              — purple
  '#00FF88', // Path Traversal    — green
  '#FF6B9D', // RCE               — pink
  '#4FC3F7', // CSRF              — light blue
  '#A0AEC0', // Other
];

const SKELETON_DATA = {
  labels: ['Loading…'],
  datasets: [{ data: [1], backgroundColor: ['rgba(61,70,99,0.3)'], borderWidth: 0 }],
};

export default function AttackTypeChart({ data, loading }) {
  const chartRef = useRef(null);

  const chartData = useMemo(() => {
    if (loading || !data || Object.keys(data).length === 0) return SKELETON_DATA;
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([k]) => k),
      datasets: [{
        data: entries.map(([, v]) => v),
        backgroundColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: entries.map((_, i) => PALETTE[i % PALETTE.length]),
        borderWidth: 1,
        hoverBorderWidth: 2,
        hoverOffset: 6,
      }],
    };
  }, [data, loading]);

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: loading ? 0 : 600, easing: 'easeInOutQuart' },
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          color: '#6B7894',
          font: { family: 'monospace', size: 10 },
          boxWidth: 8,
          boxHeight: 8,
          padding: 10,
          usePointStyle: true,
          pointStyleWidth: 8,
          generateLabels: (chart) => {
            const ds = chart.data.datasets[0];
            return (chart.data.labels || []).map((label, i) => ({
              text: `${label}  ${ds.data[i]}`,
              fillStyle: ds.backgroundColor[i],
              strokeStyle: ds.backgroundColor[i],
              lineWidth: 0,
              index: i,
              hidden: false,
            }));
          },
        },
      },
      tooltip: {
        backgroundColor: '#0D1117',
        borderColor: 'rgba(0,245,255,0.15)',
        borderWidth: 1,
        titleColor: '#E2E8F0',
        bodyColor: '#6B7894',
        titleFont: { family: 'monospace', size: 11 },
        bodyFont: { family: 'monospace', size: 10 },
        padding: 10,
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct   = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0;
            return `  ${ctx.raw} events (${pct}%)`;
          },
        },
      },
    },
  }), [loading]);

  // Update chart data without full remount on socket push
  useEffect(() => {
    if (chartRef.current && !loading && data) {
      chartRef.current.update('active');
    }
  }, [data, loading]);

  const total = !loading && data ? Object.values(data).reduce((a, b) => a + b, 0) : null;

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{
        background: '#0D1117',
        border: '1px solid rgba(0,245,255,0.08)',
        padding: '16px',
        minHeight: '240px',
      }}
      aria-label="Attack type breakdown chart"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <p className="text-[10px] font-mono tracking-widest uppercase" style={{ color: '#E2E8F0' }}>
          Attack Breakdown
        </p>
        {total !== null && (
          <span
            className="text-[9px] font-mono tabular-nums px-2 py-0.5 rounded"
            style={{ background: 'rgba(255,61,113,0.08)', color: '#FF3D71', border: '1px solid rgba(255,61,113,0.18)' }}
          >
            {total.toLocaleString()} total
          </span>
        )}
      </div>

      {/* Chart */}
      <div className="relative flex-1" style={{ minHeight: '180px' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              border: '12px solid rgba(61,70,99,0.2)',
              borderTopColor: 'rgba(0,245,255,0.2)',
              animation: 'spin 1.2s linear infinite',
            }} />
          </div>
        ) : Object.keys(data || {}).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <p className="text-[10px] font-mono" style={{ color: '#3D4663' }}>NO ATTACK DATA</p>
            <p className="text-[9px] font-mono" style={{ color: '#3D4663' }}>System is clean</p>
          </div>
        ) : (
          <Doughnut ref={chartRef} data={chartData} options={options} />
        )}
      </div>
    </section>
  );
}
