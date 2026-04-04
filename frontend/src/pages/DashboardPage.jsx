import KpiCard from '../components/app/KpiCard';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Threats Today"
          value="1,284"
          trend="+12%"
          trendUp={true}
          accent="#FF3D71"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          }
        />
        <KpiCard
          label="Blocked IPs"
          value="347"
          trend="+5"
          trendUp={true}
          accent="#FF8C00"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          }
        />
        <KpiCard
          label="Clean Requests"
          value="98,412"
          trend="+3.2%"
          trendUp={true}
          accent="#00FF88"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          }
        />
        <KpiCard
          label="Active Alerts"
          value="9"
          trend="-2"
          trendUp={false}
          accent="#00F5FF"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          }
        />
      </div>

      {/* Placeholder for next increment — threat stream + chart */}
      <div
        className="rounded-lg p-6 flex items-center justify-center"
        style={{ border: '1px dashed rgba(0,245,255,0.1)', minHeight: '320px' }}
      >
        <div className="text-center">
          <p className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: '#3D4663' }}>NEXT INCREMENT</p>
          <p className="text-xs font-mono" style={{ color: '#6B7894' }}>Live threat event stream + attack-type donut chart</p>
        </div>
      </div>
    </div>
  );
}
