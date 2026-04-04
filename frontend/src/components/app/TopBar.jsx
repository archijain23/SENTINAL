import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/app/dashboard': { title: 'Command Center',  sub: 'Live threat monitoring' },
  '/app/threats':   { title: 'Threat Feed',      sub: 'Detected attack events' },
  '/app/pcap':      { title: 'PCAP Analyzer',    sub: 'Network packet analysis' },
  '/app/blocklist': { title: 'IP Blocklist',     sub: 'Blocked address manager' },
  '/app/nexus':     { title: 'Nexus AI',         sub: 'AI security analyst' },
  '/app/settings':  { title: 'System Settings',  sub: 'Configuration & health' },
};

export default function TopBar() {
  const { pathname } = useLocation();
  const page = PAGE_TITLES[pathname] ?? { title: 'SENTINAL', sub: '' };
  const now  = new Date().toLocaleTimeString('en-US', { hour12: false });

  return (
    <header
      className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
      style={{ background: '#0D1117', borderColor: 'rgba(0,245,255,0.08)' }}
    >
      {/* Page title */}
      <div>
        <h1 className="text-sm font-display font-bold tracking-wider" style={{ color: '#E2E8F0' }}>
          {page.title}
        </h1>
        <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: '#3D4663' }}>
          {page.sub}
        </p>
      </div>

      {/* Right — clock + live badge */}
      <div className="flex items-center gap-4">
        {/* Live indicator */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#00FF88', boxShadow: '0 0 6px #00FF88', animation: 'livePulse 2s ease-in-out infinite' }}
          />
          <span className="text-[9px] font-mono tracking-widest" style={{ color: '#00FF88' }}>LIVE</span>
        </div>

        {/* System clock */}
        <span className="text-[10px] font-mono tabular-nums" style={{ color: '#3D4663' }}>
          SYS {now} IST
        </span>
      </div>
    </header>
  );
}
