import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function AppShell() {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#0B0F19' }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main
          className="flex-1 overflow-y-auto"
          style={{
            background: '#0B0F19',
            backgroundImage:
              'linear-gradient(rgba(0,245,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.02) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        >
          <div className="p-6 max-w-[1440px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
