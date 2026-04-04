frontend/
├── index.html                        ← Vite entry point
├── vite.config.js                    ← Vite + proxy config
├── tailwind.config.js                ← Custom cyber theme tokens
├── postcss.config.js
├── package.json                      ← React 18, Three.js, GSAP, Axios, Socket.IO
└── src/
    ├── main.jsx                      ← React DOM root, RouterProvider
    ├── App.jsx                       ← Landing page shell (GSAP + Three.js sections)
    ├── router.jsx                    ← createBrowserRouter (React Router v7)
    ├── animations/                   ← GSAP animation definitions
    ├── components/
    │   ├── app/                      ← Dashboard shell components
    │   │   ├── AppShell.jsx          ← Layout: Sidebar + TopBar + <Outlet>
    │   │   ├── Sidebar.jsx           ← Navigation sidebar
    │   │   ├── TopBar.jsx            ← Header bar
    │   │   ├── ProtectedRoute.jsx    ← Auth guard
    │   │   ├── KpiCard.jsx           ← KPI metric card
    │   │   ├── ThreatStream.jsx      ← Live socket threat feed
    │   │   └── ServiceHealthStrip.jsx
    │   ├── ui/                       ← Shared UI primitives
    │   ├── HeroScene.jsx             ← Three.js WebGL hero (landing)
    │   ├── FeaturesSection.jsx
    │   ├── ArchitectureFlow.jsx
    │   ├── MonitoringSection.jsx
    │   ├── NexusPolicyEngine.jsx
    │   ├── ActionQueue.jsx
    │   ├── DashboardPreview.jsx
    │   ├── CTA.jsx
    │   ├── Footer.jsx
    │   ├── Navbar.jsx
    │   ├── ThreatScanner.jsx
    │   ├── NetworkTopology.jsx
    │   └── DefenseShield.jsx
    ├── pages/                        ← 17 app pages + landing + login
    │   ├── LandingPage.jsx           ← Renders App.jsx sections
    │   ├── LoginPage.jsx
    │   ├── DashboardPage.jsx
    │   ├── ThreatsPage.jsx
    │   ├── ForensicsPage.jsx         ← threats/:id route
    │   ├── AlertsPage.jsx
    │   ├── LogsPage.jsx
    │   ├── PcapPage.jsx
    │   ├── BlocklistPage.jsx
    │   ├── NexusPage.jsx             ← Action queue management
    │   ├── SimulatePage.jsx          ← Attack simulation (16KB — largest page)
    │   ├── CopilotPage.jsx           ← Gemini AI chat
    │   ├── CorrelationPage.jsx
    │   ├── GeoPage.jsx
    │   ├── ExplorePage.jsx
    │   ├── ServicesPage.jsx
    │   ├── AuditPage.jsx
    │   ├── SettingsPage.jsx
    │   └── NotFoundPage.jsx
    ├── context/
    │   └── AuthContext.jsx           ← Session auth (demo mode only)
    ├── hooks/
    │   ├── useApi.js                 ← Custom fetch hook (no caching)
    │   ├── useSocket.js              ← Socket event subscription hook
    │   ├── useInterval.js
    │   ├── usePerformanceMode.js
    │   ├── useScrollCamera.js        ← Three.js scroll camera
    │   └── useTheme.js
    ├── services/
    │   ├── api.js                    ← Axios client + all API functions
    │   └── socket.js                 ← Socket.IO singleton + event constants
    └── styles/
        └── globals.css



    /                           → LandingPage (eager)
/login                      → LoginPage (eager)
/app                        → ProtectedRoute → AppShell (Sidebar + TopBar + Outlet)
  /app/                     → redirect → /app/dashboard
  /app/dashboard            → DashboardPage (lazy)
  /app/threats              → ThreatsPage (lazy)
  /app/threats/:id          → ForensicsPage (lazy)
  /app/alerts               → AlertsPage (lazy)
  /app/logs                 → LogsPage (lazy)
  /app/pcap                 → PcapPage (lazy)
  /app/blocklist            → BlocklistPage (lazy)
  /app/action-queue         → NexusPage (lazy)
  /app/simulate             → SimulatePage (lazy)
  /app/copilot              → CopilotPage (lazy)
  /app/correlation          → CorrelationPage (lazy)
  /app/geo                  → GeoPage (lazy)
  /app/explore              → ExplorePage (lazy)
  /app/services             → ServicesPage (lazy)
  /app/audit                → AuditPage (lazy)
  /app/settings             → SettingsPage (lazy)
*                           → NotFoundPage (lazy, protected)