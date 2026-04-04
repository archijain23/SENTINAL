// ServiceHealthStrip — bottom row showing microservice health status
// Status is mock/static for now; will poll real /health endpoints in a later increment

const SERVICES = [
  { name: 'Detection Engine',  port: 5001, status: 'online',  latency: '12ms'  },
  { name: 'PCAP Processor',    port: 5002, status: 'online',  latency: '8ms'   },
  { name: 'Nexus AI Agent',    port: 5003, status: 'online',  latency: '34ms'  },
  { name: 'Response Engine',   port: 5004, status: 'online',  latency: '6ms'   },
  { name: 'API Gateway',       port: 8000, status: 'online',  latency: '2ms'   },
];

const STATUS_CONFIG = {
  online:    { color: '#00FF88', bg: 'rgba(0,255,136,0.08)',  border: 'rgba(0,255,136,0.18)',  label: 'ONLINE'  },
  degraded:  { color: '#FFB800', bg: 'rgba(255,184,0,0.08)',  border: 'rgba(255,184,0,0.2)',   label: 'DEGRADED'},
  offline:   { color: '#FF3D71', bg: 'rgba(255,61,113,0.08)', border: 'rgba(255,61,113,0.2)',  label: 'OFFLINE' },
};

export default function ServiceHealthStrip() {
  return (
    <section aria-label="Service health">
      <p className="text-[9px] font-mono tracking-widest uppercase mb-3" style={{ color: '#3D4663' }}>SERVICE HEALTH</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {SERVICES.map(svc => {
          const cfg = STATUS_CONFIG[svc.status];
          return (
            <div
              key={svc.name}
              className="rounded-lg px-4 py-3 flex items-center justify-between"
              style={{ background: '#0D1117', border: `1px solid ${cfg.border}` }}
            >
              <div>
                <p className="text-[10px] font-mono" style={{ color: '#E2E8F0' }}>{svc.name}</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: '#3D4663' }}>:{svc.port} · {svc.latency}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: cfg.color,
                    boxShadow:  `0 0 6px ${cfg.color}`,
                    animation: svc.status === 'online' ? 'livePulse 2s ease-in-out infinite' : 'none',
                  }}
                />
                <span className="text-[8px] font-mono tracking-widest" style={{ color: cfg.color }}>{cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
