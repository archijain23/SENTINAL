/**
 * SeverityChart — Horizontal bar chart
 *
 * Data source: statsAPI.getSummary() → data.attacksBySeverity  { [severity]: count }
 * Socket:      STATS_UPDATE → data.attacksBySeverity (live updates)
 *
 * Props:
 *   data     {Object}  — { 'critical': 4, 'high': 12, 'medium': 30, 'low': 55 }
 *   loading  {boolean}
 */
import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const SEVERITY_ORDER  = ['critical', 'high', 'medium', 'low', 'info'];
const SEVERITY_COLORS = {
  critical: { bar: '#FF3D71', bg: 'rgba(255,61,113,0.15)'  },
  high:     { bar: '#FF8C00', bg: 'rgba(255,140,0,0.15)'   },
  medium:   { bar: '#FFB800', bg: 'rgba(255,184,0,0.15)'   },
  low:      { bar: '#00FF88', bg: 'rgba(0,255,136,0.12)'   },
  info:     { bar: '#00F5FF', bg: 'rgba(0,245,255,0.1)'    },
};

export default function SeverityChart({ data, loading }) {
  const { labels, counts, colors, bgColors } = useMemo(() => {
    if (loading || !data || Object.keys(data).length === 0) {
      return { labels: [], counts: [], colors: [], bgColors: [] };
    }
    // Normalise keys to lowercase, sort by severity order
    const normalised = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k.toLowerCase(), v])
    );
    const ordered = SEVERITY_ORDER.filter(s => normalised[s] !== undefined);
    // Include any unknown severity keys
    const extra = Object.keys(normalised).filter(k => !SEVERITY_ORDER.includes(k));
    const allKeys = [...ordered, ...extra];

    return {
      labels:   allKeys.map(k => k.toUpperCase()),
      counts:   allKeys.map(k => normalised[k] || 0),
      colors:   allKeys.map(k => SEVERITY_COLORS[k]?.bar  || '#6B7894'),
      bgColors: allKeys.map(k => SEVERITY_COLORS[k]?.bg   || 'rgba(107,120,148,0.15)'),
    };
  }, [data, loading]);

  const chartData = useMemo(() => ({
    labels,
    datasets: [{
      data: counts,
      backgroundColor: bgColors,
      borderColor: colors,
      borderWidth: 1,
      borderRadius: 3,
      borderSkipped: false,
      barThickness: 18,
    }],
  }), [labels, counts, colors, bgColors]);

  const maxVal = counts.length > 0 ? Math.max(...counts) : 10;

  const options = useMemo(() => ({
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500, easing: 'easeInOutQuart' },
    plugins: {
      legend: { display: false },
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
          title: (items) => items[0].label,
          label: (ctx) => `  ${ctx.raw} attacks`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(0,245,255,0.04)', drawBorder: false },
        ticks: {
          color: '#3D4663',
          font: { family: 'monospace', size: 9 },
          maxTicksLimit: 5,
          stepSize: Math.ceil(maxVal / 4) || 1,
        },
        border: { display: false },
        suggestedMax: maxVal + Math.ceil(maxVal * 0.15) + 1,
      },
      y: {
        grid: { display: false },
        ticks: {
          color: '#6B7894',
          font: { family: 'monospace', size: 10, weight: '500' },
          padding: 4,
        },
        border: { display: false },
      },
    },
  }), [maxVal]);

  return (
    <section
      className="rounded-lg flex flex-col"
      style={{
        background: '#0D1117',
        border: '1px solid rgba(0,245,255,0.08)',
        padding: '16px',
      }}
      aria-label="Attack severity distribution chart"
    >
      <p className="text-[10px] font-mono tracking-widest uppercase mb-3 shrink-0" style={{ color: '#E2E8F0' }}>
        Severity Distribution
      </p>

      <div className="flex-1" style={{ minHeight: '140px', position: 'relative' }}>
        {loading ? (
          <div className="flex flex-col gap-2.5 pt-1">
            {['60%','85%','45%','30%'].map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <div style={{ width: 40, height: 10, borderRadius: 2, background: 'rgba(61,70,99,0.3)', animation: 'shimmer 1.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
                <div style={{ width: w, height: 10, borderRadius: 2, background: 'rgba(61,70,99,0.2)', animation: 'shimmer 1.5s ease-in-out infinite', backgroundSize: '200% 100%' }} />
              </div>
            ))}
          </div>
        ) : labels.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[10px] font-mono" style={{ color: '#3D4663' }}>NO SEVERITY DATA</p>
          </div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </section>
  );
}
