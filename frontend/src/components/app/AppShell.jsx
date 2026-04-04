import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar  from './TopBar';
import styles  from './AppShell.module.css';

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={`${styles.shell} ${collapsed ? styles.collapsed : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className={styles.main}>
        <TopBar collapsed={collapsed} />
        <main className={styles.content} key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
