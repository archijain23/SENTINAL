const NAV_LINKS = {
  Product: ['WAF Engine', 'IDS Module', 'Nexus Policy', 'Action Queue', 'Dashboard'],
  Platform: ['API Reference', 'SDKs', 'Integrations', 'Changelog', 'Status Page'],
  Company: ['About', 'Blog', 'Careers', 'Security', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'DPA'],
};

const CERT_BADGES = [
  'SOC-2 TYPE II',
  'ISO 27001',
  'GDPR',
  'FedRAMP',
  'PCI-DSS',
];

export default function Footer() {
  return (
    <footer
      aria-label="SENTINAL site footer"
      className="relative border-t"
      style={{ borderColor: 'rgba(0,245,255,0.08)', background: 'rgba(8,11,18,0.98)' }}
    >
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 cyber-grid opacity-[0.06] pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Top section */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-10 py-16">
          {/* Brand column */}
          <div className="col-span-2">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-6">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
              >
                <polygon
                  points="16,2 30,9 30,23 16,30 2,23 2,9"
                  stroke="#00F5FF"
                  strokeWidth="1.5"
                  fill="rgba(0,245,255,0.06)"
                />
                <polygon
                  points="16,8 24,12 24,20 16,24 8,20 8,12"
                  stroke="#00F5FF"
                  strokeWidth="1"
                  fill="rgba(0,245,255,0.04)"
                  strokeOpacity="0.5"
                />
                <circle cx="16" cy="16" r="3" fill="#00F5FF" opacity="0.9" />
              </svg>
              <span
                className="text-lg font-display font-black tracking-widest text-white uppercase"
                style={{ letterSpacing: '0.2em' }}
              >
                SENTINAL
              </span>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed max-w-xs mb-6">
              AI-powered Web Application Firewall and Intrusion Detection System.
              Purpose-built for security operations teams.
            </p>

            {/* Cert badges */}
            <div className="flex flex-wrap gap-2">
              {CERT_BADGES.map((badge) => (
                <span
                  key={badge}
                  className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded"
                  style={{
                    border: '1px solid rgba(0,245,255,0.15)',
                    color: 'rgba(0,245,255,0.5)',
                    background: 'rgba(0,245,255,0.03)',
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(NAV_LINKS).map(([group, links]) => (
            <nav key={group} aria-label={`${group} links`}>
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-gray-600 mb-5">
                {group}
              </h3>
              <ul role="list" className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-xs text-gray-500 hover:text-cyber-blue transition-colors duration-200 font-mono"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Divider */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(0,245,255,0.15), transparent)',
          }}
          aria-hidden="true"
        />

        {/* Bottom bar */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 py-6">
          <p className="text-[10px] font-mono text-gray-700">
            © 2026 SENTINAL SECURITY INC. ALL RIGHTS RESERVED.
          </p>

          <div className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"
              aria-hidden="true"
            />
            <span className="text-[10px] font-mono text-gray-700">
              ALL SYSTEMS OPERATIONAL
            </span>
          </div>

          <div className="flex items-center gap-6">
            {['Twitter', 'LinkedIn', 'GitHub'].map((social) => (
              <a
                key={social}
                href="#"
                className="text-[10px] font-mono text-gray-700 hover:text-cyber-blue transition-colors duration-200"
                aria-label={`SENTINAL on ${social}`}
              >
                {social.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
