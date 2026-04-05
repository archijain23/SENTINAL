import { useState } from 'react';
import styles from './DocsPage.module.css';

const NAV = [
  { id: 'quickstart',   label: 'Quick Start' },
  { id: 'install',      label: 'Installation' },
  { id: 'config',       label: 'Configuration' },
  { id: 'integration',  label: 'Integration Modes' },
  { id: 'api-attacks',  label: 'Attacks API' },
  { id: 'api-alerts',   label: 'Alerts API' },
  { id: 'api-blocklist',label: 'Blocklist API' },
  { id: 'api-logs',     label: 'Logs API' },
  { id: 'api-stats',    label: 'Stats API' },
  { id: 'api-settings', label: 'Settings API' },
  { id: 'api-gemini',   label: 'AI Copilot API' },
  { id: 'api-geo',      label: 'Geo Intel API' },
  { id: 'api-pcap',     label: 'PCAP API' },
  { id: 'sockets',      label: 'Socket Events' },
  { id: 'middleware',   label: 'Express Middleware' },
  { id: 'errors',       label: 'Error Codes' },
];

function CodeBlock({ code, lang = 'bash' }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang}</span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{code.trim()}</code></pre>
    </div>
  );
}

function Badge({ type }) {
  const map = {
    GET:    styles.badgeGet,
    POST:   styles.badgePost,
    DELETE: styles.badgeDel,
    PATCH:  styles.badgePatch,
    PUT:    styles.badgePut,
  };
  return <span className={`${styles.badge} ${map[type] || ''}`}>{type}</span>;
}

function Endpoint({ method, path, description, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.endpoint}>
      <button className={styles.endpointHeader} onClick={() => setOpen(o => !o)}>
        <div className={styles.endpointMeta}>
          <Badge type={method} />
          <code className={styles.endpointPath}>{path}</code>
        </div>
        <span className={styles.endpointDesc}>{description}</span>
        <span className={styles.endpointChevron}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className={styles.endpointBody}>{children}</div>}
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section className={styles.section} id={id}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

function ParamTable({ rows }) {
  return (
    <table className={styles.paramTable}>
      <thead>
        <tr><th>Parameter</th><th>Type</th><th>Required</th><th>Description</th></tr>
      </thead>
      <tbody>
        {rows.map(([name, type, req, desc]) => (
          <tr key={name}>
            <td><code>{name}</code></td>
            <td><span className={styles.typeTag}>{type}</span></td>
            <td>{req === 'yes' ? <span className={styles.req}>Required</span> : <span className={styles.opt}>Optional</span>}</td>
            <td>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DocsPage() {
  const [active, setActive] = useState('quickstart');

  const scrollTo = (id) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={styles.root}>
      {/* Sidebar nav */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c8ff" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
          </svg>
          <span>SENTINAL Docs</span>
        </div>
        <nav>
          {NAV.map(n => (
            <button
              key={n.id}
              className={`${styles.navItem} ${active === n.id ? styles.navActive : ''}`}
              onClick={() => scrollTo(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className={styles.main}>
        <div className={styles.hero}>
          <span className={styles.heroBadge}>SDK & API Reference</span>
          <h1 className={styles.heroTitle}>SENTINAL Developer Docs</h1>
          <p className={styles.heroSub}>
            Integrate AI-powered WAF + IDS protection into any Node.js, Python, or HTTP-compatible application.
            Real-time threat detection, blocklist management, and Gemini-powered analysis via REST + WebSocket.
          </p>
          <div className={styles.heroInstall}>
            <CodeBlock code="npm install sentinal-client" />
          </div>
        </div>

        {/* Quick Start */}
        <Section id="quickstart" title="Quick Start">
          <p className={styles.lead}>
            Get threat detection running in under 5 minutes using the SENTINAL npm client or direct REST calls.
          </p>
          <CodeBlock lang="javascript" code={`
import Sentinal from 'sentinal-client';

const sentinal = new Sentinal({
  baseURL: 'http://localhost:3000',
  apiKey:  process.env.SENTINAL_API_KEY,
});

// Report an incoming request for threat analysis
const result = await sentinal.attacks.report({
  ip:        '203.0.113.45',
  method:    'POST',
  url:       '/api/login',
  userAgent: req.headers['user-agent'],
  body:      JSON.stringify(req.body),
});

if (result.data.blocked) {
  return res.status(403).json({ error: 'Access denied' });
}
          `} />
        </Section>

        {/* Installation */}
        <Section id="install" title="Installation">
          <h3 className={styles.h3}>npm / yarn / pnpm</h3>
          <CodeBlock lang="bash" code={`
npm install sentinal-client
# or
yarn add sentinal-client
# or
pnpm add sentinal-client
          `} />
          <h3 className={styles.h3}>Direct REST (no SDK)</h3>
          <p>All endpoints are plain REST. Use any HTTP client — <code>fetch</code>, <code>axios</code>, <code>curl</code>, or <code>requests</code> (Python).</p>
          <CodeBlock lang="bash" code={`
# Health check
curl http://localhost:3000/api/health
          `} />
          <h3 className={styles.h3}>Requirements</h3>
          <ul className={styles.list}>
            <li>Node.js <code>≥ 18</code> or any HTTP client</li>
            <li>SENTINAL backend running (<code>npm start</code> in <code>/backend</code>)</li>
            <li>MongoDB connection configured in backend <code>.env</code></li>
          </ul>
        </Section>

        {/* Configuration */}
        <Section id="config" title="Configuration">
          <p className={styles.lead}>
            All configuration lives in <code>backend/.env</code>. Copy <code>.env.example</code> and fill in your values.
          </p>
          <CodeBlock lang="bash" code={`
# Backend — backend/.env
MONGO_URI=mongodb://localhost:27017/sentinal
PORT=3000
GEMINI_API_KEY=your_google_gemini_key
MAXMIND_LICENSE_KEY=your_maxmind_key
CORS_ORIGIN=http://localhost:5173
          `} />
          <CodeBlock lang="bash" code={`
# Frontend — frontend/.env (or .env.local)
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
          `} />
          <h3 className={styles.h3}>SDK Constructor Options</h3>
          <ParamTable rows={[
            ['baseURL',    'string',   'yes', 'Base URL of SENTINAL backend, e.g. http://localhost:3000'],
            ['apiKey',     'string',   'yes', 'API key set in your backend .env as SENTINAL_API_KEY'],
            ['timeout',    'number',   'no',  'Request timeout in milliseconds. Default: 10000'],
            ['retries',    'number',   'no',  'Auto-retry count on 5xx errors. Default: 2'],
            ['onError',    'function', 'no',  'Global error callback (err) => void'],
          ]} />
        </Section>

        {/* Integration Modes */}
        <Section id="integration" title="Integration Modes">
          <h3 className={styles.h3}>Mode 1 — Express Middleware (Recommended)</h3>
          <p>Attach SENTINAL as middleware to inspect every incoming request automatically.</p>
          <CodeBlock lang="javascript" code={`
import express from 'express';
import { sentinalMiddleware } from 'sentinal-client';

const app = express();

// Place before all your routes
app.use(sentinalMiddleware({
  baseURL:   'http://localhost:3000',
  apiKey:    process.env.SENTINAL_API_KEY,
  blockMode: true,
  blockThreshold: 'high',
}));

app.get('/api/data', (req, res) => res.json({ ok: true }));
          `} />
          <h3 className={styles.h3}>Mode 2 — Manual Reporting</h3>
          <CodeBlock lang="javascript" code={`
app.post('/api/login', async (req, res) => {
  await sentinal.attacks.report({
    ip:        req.ip,
    method:    req.method,
    url:       req.originalUrl,
    userAgent: req.headers['user-agent'],
    headers:   JSON.stringify(req.headers),
    body:      JSON.stringify(req.body),
  });
  // continue login logic
});
          `} />
          <h3 className={styles.h3}>Mode 3 — Python / HTTP direct</h3>
          <CodeBlock lang="python" code={`
import requests

SENTINAL = "http://localhost:3000"

def report_attack(ip, url, method, body=""):
    res = requests.post(f"{SENTINAL}/api/attacks/report", json={
        "ip": ip, "url": url, "method": method, "body": body,
    })
    return res.json()

def is_blocked(ip):
    r = requests.get(f"{SENTINAL}/api/blocklist/check/{ip}")
    return r.json().get("blocked", False)
          `} />
        </Section>

        {/* Attacks API */}
        <Section id="api-attacks" title="Attacks API">
          <p className={styles.lead}>Report, retrieve, and search detected attack events.</p>
          <Endpoint method="POST" path="/api/attacks/report" description="Report an incoming request for threat analysis">
            <h4>Request Body</h4>
            <ParamTable rows={[
              ['ip',        'string', 'yes', 'Source IP address of the request'],
              ['method',    'string', 'yes', 'HTTP method (GET, POST, etc.)'],
              ['url',       'string', 'yes', 'Request path and query string'],
              ['userAgent', 'string', 'no',  'User-Agent header value'],
              ['headers',   'string', 'no',  'JSON-stringified request headers'],
              ['body',      'string', 'no',  'JSON-stringified request body'],
            ]} />
            <h4>Response</h4>
            <CodeBlock lang="json" code={`
{
  "success": true,
  "data": {
    "_id": "665a1b2c3d4e5f6a7b8c9d0e",
    "ip": "203.0.113.45",
    "attackType": "sql_injection",
    "severity": "critical",
    "confidence": 0.97,
    "blocked": true,
    "timestamp": "2026-04-05T06:00:00.000Z"
  }
}
            `} />
          </Endpoint>
          <Endpoint method="GET" path="/api/attacks/recent" description="Fetch most recent attack events">
            <ParamTable rows={[
              ['limit', 'number', 'no', 'Number of records to return. Default: 20, max: 100'],
            ]} />
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/attacks/recent?limit=10" />
          </Endpoint>
          <Endpoint method="GET" path="/api/attacks/search" description="Atlas full-text search across attack records">
            <ParamTable rows={[
              ['q', 'string', 'yes', 'Search term — searches across IP, URL, attackType, userAgent'],
            ]} />
            <CodeBlock lang="bash" code={`curl "http://localhost:3000/api/attacks/search?q=sql_injection"`} />
          </Endpoint>
          <Endpoint method="GET" path="/api/attacks/search/stats" description="Aggregated stats from Atlas Search index">
            <CodeBlock lang="json" code={`
{
  "success": true,
  "data": {
    "totalAttacks": 1482,
    "byType": { "sql_injection": 412, "xss": 288 },
    "bySeverity": { "critical": 310, "high": 590 }
  }
}
            `} />
          </Endpoint>
        </Section>

        {/* Alerts API */}
        <Section id="api-alerts" title="Alerts API">
          <p className={styles.lead}>Security alert lifecycle management.</p>
          <Endpoint method="GET" path="/api/alerts" description="Fetch all alerts (read and unread)">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/alerts" />
          </Endpoint>
          <Endpoint method="PATCH" path="/api/alerts/:id/read" description="Mark a single alert as read">
            <CodeBlock lang="bash" code="curl -X PATCH http://localhost:3000/api/alerts/665a1b.../read" />
          </Endpoint>
          <Endpoint method="PATCH" path="/api/alerts/read-all" description="Mark all alerts as read">
            <CodeBlock lang="bash" code="curl -X PATCH http://localhost:3000/api/alerts/read-all" />
          </Endpoint>
        </Section>

        {/* Blocklist API */}
        <Section id="api-blocklist" title="Blocklist API">
          <p className={styles.lead}>Manage blocked IP addresses — used by the Response Engine and manual operator overrides.</p>
          <Endpoint method="GET" path="/api/blocklist" description="List all currently active blocked IPs">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/blocklist" />
          </Endpoint>
          <Endpoint method="GET" path="/api/blocklist/check/:ip" description="Check if a single IP is currently blocked (fast lookup)">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/blocklist/check/203.0.113.45" />
            <h4>Response</h4>
            <CodeBlock lang="json" code={`
{ "blocked": true, "data": { "ip": "203.0.113.45", "expiresAt": "..." } }
// or
{ "blocked": false, "data": null }
            `} />
          </Endpoint>
          <Endpoint method="POST" path="/api/blocklist" description="Block an IP address">
            <ParamTable rows={[
              ['ip',              'string', 'yes', 'IPv4 or IPv6 address to block'],
              ['reason',          'string', 'no',  'Human-readable reason for the block'],
              ['attackType',      'string', 'no',  'e.g. sql_injection, brute_force, xss'],
              ['attackId',        'string', 'no',  'ID of the attack record that triggered the block'],
              ['durationMinutes', 'number', 'no',  'Block duration. Omit for permanent block.'],
              ['blockedBy',       'string', 'no',  'Identifier of who/what triggered the block'],
            ]} />
            <CodeBlock lang="javascript" code={`
await fetch('http://localhost:3000/api/blocklist', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    ip:              '203.0.113.45',
    reason:          'Brute force login attempts',
    attackType:      'brute_force',
    durationMinutes: 60,
  }),
});
            `} />
          </Endpoint>
          <Endpoint method="DELETE" path="/api/blocklist/:ip" description="Unblock an IP (human override)">
            <CodeBlock lang="bash" code="curl -X DELETE http://localhost:3000/api/blocklist/203.0.113.45" />
          </Endpoint>
        </Section>

        {/* Logs API */}
        <Section id="api-logs" title="Logs API">
          <Endpoint method="GET" path="/api/logs/recent" description="Fetch recent system and access logs">
            <ParamTable rows={[
              ['limit', 'number', 'no', 'Number of log entries. Default: 50, max: 200'],
            ]} />
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/logs/recent?limit=100" />
          </Endpoint>
        </Section>

        {/* Stats API */}
        <Section id="api-stats" title="Stats API">
          <Endpoint method="GET" path="/api/stats" description="Global threat detection statistics summary">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/stats" />
            <h4>Response</h4>
            <CodeBlock lang="json" code={`
{
  "totalRequests": 48291,
  "threatsDetected": 1482,
  "blockedIPs": 37,
  "activeAlerts": 14,
  "attacksByType": { "sql_injection": 412, "xss": 288 },
  "requestsLast24h": [120, 145, 98, 203],
  "uptimeSeconds": 86400
}
            `} />
          </Endpoint>
        </Section>

        {/* Settings API */}
        <Section id="api-settings" title="Settings API">
          <Endpoint method="GET" path="/api/settings" description="Retrieve current SENTINAL configuration">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/settings" />
          </Endpoint>
          <Endpoint method="PUT" path="/api/settings" description="Update SENTINAL configuration">
            <CodeBlock lang="javascript" code={`
await fetch('http://localhost:3000/api/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    waf: { enabled: true, strictMode: false, blockMode: true },
    ids: { enabled: true, threshold: 0.85 },
    alerts: { email: 'ops@company.com', minSeverity: 'high' },
  }),
});
            `} />
          </Endpoint>
        </Section>

        {/* Gemini AI API */}
        <Section id="api-gemini" title="AI Copilot API">
          <p className={styles.lead}>
            SENTINAL embeds Google Gemini as a security co-pilot. Use these endpoints to get AI analysis on threats, generate reports, and correlate incidents.
          </p>
          <Endpoint method="POST" path="/api/gemini/chat" description="Send a message to the AI security copilot">
            <ParamTable rows={[
              ['message', 'string', 'yes', 'Your question or instruction'],
              ['history', 'array',  'no',  'Previous conversation turns [{role, content}]'],
              ['context', 'object', 'no',  'Optional: attach threat/attack data as context'],
            ]} />
            <CodeBlock lang="javascript" code={`
const res = await fetch('http://localhost:3000/api/gemini/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Explain this SQL injection pattern and suggest mitigations',
    context: { attackId: '665a1b2c3d4e5f...' },
  }),
});
const { reply } = await res.json();
            `} />
          </Endpoint>
          <Endpoint method="POST" path="/api/gemini/report/:id" description="Generate an AI forensics report for an attack">
            <CodeBlock lang="bash" code="curl -X POST http://localhost:3000/api/gemini/report/665a1b2c3d4e5f" />
          </Endpoint>
          <Endpoint method="POST" path="/api/gemini/correlate" description="AI correlation analysis across multiple attacks">
            <CodeBlock lang="javascript" code={`
await fetch('http://localhost:3000/api/gemini/correlate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ attackIds: ['id1', 'id2', 'id3'] }),
});
            `} />
          </Endpoint>
        </Section>

        {/* Geo Intel API */}
        <Section id="api-geo" title="Geo Intel API">
          <Endpoint method="GET" path="/api/geo/ip/:ip" description="Get geolocation + threat intelligence for an IP">
            <CodeBlock lang="bash" code="curl http://localhost:3000/api/geo/ip/203.0.113.45" />
            <h4>Response</h4>
            <CodeBlock lang="json" code={`
{
  "ip": "203.0.113.45",
  "country": "China",
  "city": "Beijing",
  "lat": 39.9042,
  "lon": 116.4074,
  "isp": "China Telecom",
  "threatScore": 87,
  "knownMalicious": true,
  "attackCount": 14
}
            `} />
          </Endpoint>
          <Endpoint method="GET" path="/api/geo/heatmap" description="GeoJSON heatmap data for the world threat map" />
          <Endpoint method="GET" path="/api/geo/stats" description="Geographic threat distribution statistics" />
          <Endpoint method="GET" path="/api/geo/top-sources" description="Top attacking countries and IP ranges" />
        </Section>

        {/* PCAP API */}
        <Section id="api-pcap" title="PCAP API">
          <p className={styles.lead}>Upload and analyze packet capture files for deep network forensics.</p>
          <Endpoint method="POST" path="/api/pcap/upload" description="Upload a .pcap or .pcapng file for analysis">
            <CodeBlock lang="javascript" code={`
const form = new FormData();
form.append('file', pcapFileBlob, 'capture.pcap');
await fetch('http://localhost:3000/api/pcap/upload', {
  method: 'POST', body: form,
});
            `} />
            <CodeBlock lang="bash" code={`curl -X POST http://localhost:3000/api/pcap/upload -F "file=@capture.pcap"`} />
          </Endpoint>
          <Endpoint method="GET" path="/api/pcap" description="List analyzed PCAP sessions">
            <ParamTable rows={[['limit', 'number', 'no', 'Sessions to return. Default: 20']]} />
          </Endpoint>
          <Endpoint method="GET" path="/api/pcap/jobs" description="List active and completed PCAP analysis jobs">
            <ParamTable rows={[['limit', 'number', 'no', 'Jobs to return. Default: 20']]} />
          </Endpoint>
        </Section>

        {/* Socket Events */}
        <Section id="sockets" title="Socket Events">
          <p className={styles.lead}>
            Connect via <code>socket.io-client</code> for real-time threat intelligence pushed from the server.
          </p>
          <CodeBlock lang="javascript" code={`
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on('connect', () => console.log('SENTINAL socket connected'));

// New attack detected
socket.on('attack:new', (attack) => {
  console.log('[THREAT]', attack.attackType, attack.ip, attack.severity);
});

// Stats updated (every 5 seconds)
socket.on('stats:update', (stats) => { updateKpiDashboard(stats); });

// New alert raised
socket.on('alert:new', (alert) => { showNotification(alert.title, alert.severity); });
          `} />
          <table className={styles.paramTable}>
            <thead>
              <tr><th>Event</th><th>Direction</th><th>Payload</th><th>Description</th></tr>
            </thead>
            <tbody>
              {[
                ['attack:new',        '← Server', 'Attack object',    'New attack detected and classified'],
                ['attack:update',     '← Server', 'Partial Attack',   'Attack record updated (severity upgraded)'],
                ['alert:new',         '← Server', 'Alert object',     'New security alert raised'],
                ['alert:resolved',    '← Server', '{ alertId }',      'Alert marked as resolved'],
                ['stats:update',      '← Server', 'Stats snapshot',   'Global stats refreshed (~every 5s)'],
                ['health:update',     '← Server', 'Health snapshot',  'Service health status changed'],
                ['service:status',    '← Server', 'Service list',     'Individual service up/down change'],
                ['log:new',           '← Server', 'Log entry',        'New system log entry appended'],
                ['queue:update',      '← Server', 'Action queue',     'Pending action queue changed'],
                ['action:decision',   '← Server', '{ id, decision }', 'Human approved/rejected an action'],
                ['geo:event',         '← Server', 'Geo attack event', 'Geolocated threat for the world map'],
                ['correlation:score', '← Server', 'Correlation result','AI correlation analysis completed'],
              ].map(([e, dir, payload, desc]) => (
                <tr key={e}>
                  <td><code>{e}</code></td>
                  <td><span className={styles.dirTag}>{dir}</span></td>
                  <td>{payload}</td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Express Middleware */}
        <Section id="middleware" title="Express Middleware">
          <p className={styles.lead}>
            Drop-in middleware that automatically inspects and reports every incoming HTTP request to SENTINAL.
          </p>
          <CodeBlock lang="javascript" code={`
import express from 'express';
import { sentinalMiddleware } from 'sentinal-client';

const app = express();
app.use(express.json());

// Place SENTINAL before your routes
app.use(sentinalMiddleware({
  baseURL:        'http://localhost:3000',
  apiKey:         process.env.SENTINAL_API_KEY,
  blockMode:      true,
  blockThreshold: 'high',
  ignore:         ['/health', '/favicon.ico', /^\/static\//],
  onBlock: (req, res, threat) => {
    res.status(403).json({
      error:     'Forbidden',
      reason:    threat.attackType,
      requestId: threat._id,
    });
  },
}));

app.get('/api/data', (req, res) => res.json({ ok: true }));
app.listen(8080);
          `} />
        </Section>

        {/* Error Codes */}
        <Section id="errors" title="Error Codes">
          <p className={styles.lead}>All SENTINAL API errors follow a consistent JSON envelope.</p>
          <CodeBlock lang="json" code={`
{
  "success": false,
  "message": "Human-readable error message",
  "code": "ERROR_CODE_CONSTANT"
}
          `} />
          <table className={styles.paramTable}>
            <thead>
              <tr><th>HTTP</th><th>Code</th><th>Meaning</th></tr>
            </thead>
            <tbody>
              {[
                ['400', 'BAD_REQUEST',        'Missing or invalid required fields'],
                ['401', 'UNAUTHORIZED',       'Invalid or missing API key'],
                ['403', 'FORBIDDEN',          'Request blocked by WAF policy'],
                ['404', 'NOT_FOUND',          'Resource not found'],
                ['409', 'DUPLICATE',          'Record already exists (e.g. IP already blocked)'],
                ['422', 'VALIDATION_ERROR',   'Request body failed schema validation'],
                ['429', 'RATE_LIMITED',       'Too many requests from this IP'],
                ['500', 'SERVER_ERROR',       'Unexpected internal server error'],
                ['503', 'SERVICE_UNAVAILABLE','Database or AI service temporarily offline'],
              ].map(([code, constant, desc]) => (
                <tr key={constant}>
                  <td><code>{code}</code></td>
                  <td><code>{constant}</code></td>
                  <td>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

      </main>
    </div>
  );
}
