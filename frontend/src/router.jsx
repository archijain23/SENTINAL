import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './components/app/AppShell';
import ProtectedRoute from './components/app/ProtectedRoute';

// Landing (eager)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';

// App pages (lazy)
const DashboardPage   = lazy(() => import('./pages/DashboardPage'));
const ThreatsPage     = lazy(() => import('./pages/ThreatsPage'));
const PcapPage        = lazy(() => import('./pages/PcapPage'));
const BlocklistPage   = lazy(() => import('./pages/BlocklistPage'));
const NexusPage       = lazy(() => import('./pages/NexusPage'));
const SettingsPage    = lazy(() => import('./pages/SettingsPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[40vh]">
      <div className="flex gap-2">
        {[0,1,2].map(i => (
          <span key={i} className="w-1.5 h-1.5 rounded-full"
            style={{ background:'rgba(0,245,255,0.4)', animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  // Public routes
  { path: '/',      element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },

  // Protected app routes — all share AppShell
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true,          element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard',   element: <Suspense fallback={<PageLoader />}><DashboardPage /></Suspense> },
      { path: 'threats',     element: <Suspense fallback={<PageLoader />}><ThreatsPage /></Suspense> },
      { path: 'pcap',        element: <Suspense fallback={<PageLoader />}><PcapPage /></Suspense> },
      { path: 'blocklist',   element: <Suspense fallback={<PageLoader />}><BlocklistPage /></Suspense> },
      { path: 'nexus',       element: <Suspense fallback={<PageLoader />}><NexusPage /></Suspense> },
      { path: 'settings',    element: <Suspense fallback={<PageLoader />}><SettingsPage /></Suspense> },
    ],
  },

  // Fallback
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default router;
