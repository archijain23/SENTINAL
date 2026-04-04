import { useState, useEffect, useRef } from 'react';
import KpiCard from '../components/app/KpiCard';
import ThreatStream from '../components/app/ThreatStream';
import ServiceHealthStrip from '../components/app/ServiceHealthStrip';

export default function DashboardPage() {
  return (
    <div className="space-y-5">

      {/* ── KPI Row ── */}
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

      {/* ── Main content: Threat Stream (left) + Attack Breakdown placeholder (right) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Threat event stream — 60% */}
        <div className="xl:col-span-3">
          <ThreatStream />
        </div>

        {/* Attack breakdown chart — placeholder for next increment */}
        <div
          className="xl:col-span-2 rounded-lg flex flex-col items-center justify-center"
          style={{ background: '#0D1117', border: '1px solid rgba(0,245,255,0.08)', minHeight: '420px' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,245,255,0.2)" strokeWidth="1" className="mb-3">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <p className="text-[9px] font-mono tracking-widest uppercase" style={{ color: '#3D4663' }}>ATTACK BREAKDOWN</p>
          <p className="text-[9px] font-mono mt-1" style={{ color: '#3D4663' }}>Donut chart — next increment</p>
        </div>
      </div>

      {/* ── Service Health Strip ── */}
      <ServiceHealthStrip />

    </div>
  );
}
