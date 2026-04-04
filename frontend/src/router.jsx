import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/app/AppShell';
import ProtectedRoute from './components/app/ProtectedRoute';

// Landing (eager)
import LandingPage from './pages/LandingPage';
import LoginPage   from './pages/LoginPage';

// App pages (lazy)
const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const ThreatsPage     = lazy(() => import('./pages/ThreatsPage'));
const ForensicsPage   = lazy(() => import('./pages/ForensicsPage'));
const PcapPage        = lazy(() => import('./pages/PcapPage'));
const BlocklistPage   = lazy(() => import('./pages/BlocklistPage'));
const NexusPage       = lazy(() => import('./pages/NexusPage'));
const SettingsPage    = lazy(() => import('./pages/SettingsPage'));
const AlertsPage      = lazy(() => import('./pages/AlertsPage'));
const LogsPage        = lazy(() => import('./pages/LogsPage'));
const ServicesPage    = lazy(() => import('./pages/ServicesPage'));
const AuditPage       = lazy(() => import('./pages/AuditPage'));
const SimulatePage    = lazy(() => import('./pages/SimulatePage'));
const CopilotPage     = lazy(() => import('./pages/CopilotPage'));
const CorrelationPage = lazy(() => import('./pages/CorrelationPage'));
const GeoPage         = lazy(() => import('./pages/GeoPage'));
const ExplorePage     = lazy(() => import('./pages/ExplorePage'));
const NotFoundPage    = lazy(() => import('./pages/NotFoundPage'));

function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', minHeight:'40vh' }}>
      <div style={{ display:'flex', gap:'6px' }}>
        {[0,1,2].map(i => (
          <span key={i} style={{
            width:'8px', height:'8px', borderRadius:'50%',
            background:'rgba(0,245,255,0.5)',
            animation:`pulse 1.2s ease-in-out ${i*0.18}s infinite`
          }} />
        ))}
      </div>
    </div>
  );
}

const W = (Page) => (
  <ProtectedRoute>
    <Suspense fallback={<PageLoader />}><Page /></Suspense>
  </ProtectedRoute>
);

const router = createBrowserRouter([
  // Public
  { path: '/',      element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },

  // Protected app shell
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true,              element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard',        element: W(DashboardPage) },
      { path: 'threats',          element: W(ThreatsPage) },
      { path: 'threats/:id',      element: W(ForensicsPage) },
      { path: 'alerts',           element: W(AlertsPage) },
      { path: 'logs',             element: W(LogsPage) },
      { path: 'pcap',             element: W(PcapPage) },
      { path: 'blocklist',        element: W(BlocklistPage) },
      { path: 'action-queue',     element: W(NexusPage) },
      { path: 'simulate',         element: W(SimulatePage) },
      { path: 'copilot',          element: W(CopilotPage) },
      { path: 'correlation',      element: W(CorrelationPage) },
      { path: 'geo',              element: W(GeoPage) },
      { path: 'explore',          element: W(ExplorePage) },
      { path: 'services',         element: W(ServicesPage) },
      { path: 'audit',            element: W(AuditPage) },
      { path: 'settings',         element: W(SettingsPage) },
    ],
  },

  // 404
  { path: '*', element: W(NotFoundPage) },
]);

export default router;
