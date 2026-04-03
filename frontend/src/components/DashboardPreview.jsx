import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { flashAttackNode } from '../animations/packetAnimations';

gsap.registerPlugin(ScrollTrigger);

const THREAT_EVENTS = [
  { id: 1, time: '09:41:02', type: 'SQL Injection',       src: '185.220.101.47', severity: 'CRITICAL', status: 'BLOCKED',   country: 'RU' },
  { id: 2, time: '09:41:05', type: 'XSS Attempt',         src: '92.118.160.12',  severity: 'HIGH',     status: 'BLOCKED',   country: 'CN' },
  { id: 3, time: '09:41:09', type: 'Path Traversal',      src: '45.155.205.10',  severity: 'HIGH',     status: 'BLOCKED',   country: 'NL' },
  { id: 4, time: '09:41:11', type: 'Credential Stuffing', src: '194.165.16.65',  severity: 'MEDIUM',   status: 'CHALLENGE', country: 'DE' },
  { id: 5, time: '09:41:14', type: 'Rate Limit Breach',   src: '103.21.244.0',   severity: 'LOW',      status: 'LOGGED',    country: 'IN' },
];

const SEV_COLOR    = { CRITICAL: '#FF3D71', HIGH: '#FF8C00', MEDIUM: '#FFB800', LOW: '#00F5FF' };
const STATUS_COLOR = { BLOCKED: '#FF3D71', CHALLENGE: '#FFB800', LOGGED: '#00F5FF', ALLOW: '#00FF88' };

const KPI_STATS = [
  { label: 'Requests / sec', value: '48,291', delta: '+12%',   up: true  },
  { label: 'Threats Blocked', value: '1,847', delta: 'last 1h', up: null  },
  { label: 'Avg Latency',     value: '1.4 ms', delta: '-0.2ms', up: false },
  { label: 'Policy Rules',    value: '3,204',  delta: 'active', up: null  },
];

export default function DashboardPreview() {
  const containerRef  = useRef(null);
  const rowRefs       = useRef([]);
  const intervalRef   = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Scoped context — only kills this section’s triggers on cleanup
    const ctx = gsap.context(() => {
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 80, rotateX: 8 },
        {
          opacity: 1, y: 0, rotateX: 0, duration: 1.1, ease: 'power4.out',
          immediateRender: false,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Row flash interval — separate effect for clean teardown
  useEffect(() => {
    let idx = 0;
    intervalRef.current = setInterval(() => {
      const criticalRows = rowRefs.current.filter(
        (_, i) => THREAT_EVENTS[i]?.severity === 'CRITICAL' || THREAT_EVENTS[i]?.severity === 'HIGH'
      );
      if (criticalRows[idx % criticalRows.length]) {
        flashAttackNode(criticalRows[idx % criticalRows.length]);
      }
      idx++;
    }, 2200);
    return () => clearInterval(intervalRef.current);
  }, []);

  return (
    <section
      id="dashboard"
      aria-label="SENTINAL SOC Dashboard Preview"
      className="relative py-32 overflow-hidden"
    >
      <div className="absolute inset-0 cyber-grid opacity-10 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="mb-14">
          <p className="text-xs tracking-[0.3em] text-cyber-blue font-mono uppercase mb-3">
            SOC.INTERFACE — LIVE FEED
          </p>
          <h2 className="text-3xl font-display font-bold text-white">
            Security Command
            <br />
            <span className="text-cyber-blue">Center Interface</span>
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl text-sm leading-relaxed">
            Everything your SOC team needs in one terminal. Real-time events,
            analyst queue, policy tuning and executive metrics.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden"
          style={{
            border: '1px solid rgba(0,245,255,0.15)',
            boxShadow: '0 0 80px rgba(0,245,255,0.06), 0 40px 80px rgba(0,0,0,0.6)',
            background: 'rgba(11,15,25,0.98)',
          }}
          role="img"
          aria-label="Interactive SOC dashboard showing real-time threat events"
        >
          {/* Title bar */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(0,245,255,0.08)', background: 'rgba(0,245,255,0.03)' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden="true">
                <span className="w-3 h-3 rounded-full" style={{ background: '#FF3D71' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#FFB800' }} />
                <span className="w-3 h-3 rounded-full" style={{ background: '#00FF88' }} />
              </div>
              <span className="text-xs font-mono text-gray-500">SENTINAL // SOC TERMINAL v4.2.1</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs font-mono text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
                SYSTEM NOMINAL
              </span>
              <span className="text-xs font-mono text-gray-600">UTC 09:41:14</span>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px" style={{ borderBottom: '1px solid rgba(0,245,255,0.08)', background: 'rgba(0,245,255,0.04)' }}>
            {KPI_STATS.map((stat) => (
              <div key={stat.label} className="px-5 py-4" style={{ background: 'rgba(11,15,25,0.95)' }}>
                <p className="text-[10px] font-mono text-gray-600 uppercase tracking-widest mb-1">{stat.label}</p>
                <p className="text-xl font-display font-bold text-white tabular-nums">{stat.value}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: stat.up === true ? '#00FF88' : stat.up === false ? '#FF3D71' : '#4a5568' }}>
                  {stat.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Threat feed table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono" aria-label="Live threat events">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,245,255,0.06)' }}>
                  {['TIME', 'THREAT TYPE', 'SOURCE IP', 'COUNTRY', 'SEVERITY', 'ACTION'].map((h) => (
                    <th key={h} scope="col" className="px-5 py-3 text-left text-[10px] tracking-widest text-gray-600 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {THREAT_EVENTS.map((event, i) => (
                  <tr
                    key={event.id}
                    ref={(el) => (rowRefs.current[i] = el)}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.3s ease, box-shadow 0.3s ease' }}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-500">{event.time}</td>
                    <td className="px-5 py-3 text-white font-medium">{event.type}</td>
                    <td className="px-5 py-3 text-cyber-blue">{event.src}</td>
                    <td className="px-5 py-3 text-gray-500">{event.country}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest" style={{ color: SEV_COLOR[event.severity] }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: SEV_COLOR[event.severity] }} aria-hidden="true" />
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest"
                        style={{ color: STATUS_COLOR[event.status], border: `1px solid ${STATUS_COLOR[event.status]}44`, background: `${STATUS_COLOR[event.status]}11` }}
                      >
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom bar */}
          <div
            className="flex items-center justify-between px-5 py-2"
            style={{ borderTop: '1px solid rgba(0,245,255,0.06)', background: 'rgba(0,245,255,0.02)' }}
          >
            <span className="text-[10px] font-mono text-gray-700">Showing 5 of 1,847 events this hour</span>
            <span className="text-[10px] font-mono text-gray-700">Policy Engine: NEXUS v3 // Rules: 3,204 active</span>
          </div>
        </div>
      </div>
    </section>
  );
}
