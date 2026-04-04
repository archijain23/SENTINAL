import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import styles from './TopBar.module.css';

const ROUTE_LABELS = {
  '/dashboard':    'Dashboard',
  '/explore':      'Explore',
  '/attacks':      'Attacks',
  '/alerts':       'Alerts',
  '/logs':         'Logs',
  '/pcap':         'PCAP Analyzer',
  '/services':     'Services',
  '/settings':     'Settings',
  '/docs':         'Documentation',
  '/action-queue': 'Action Queue',
  '/audit':        'Audit Log',
  '/simulate':     'Attack Simulator',
  '/blocklist':    'Blocklist',
  '/copilot':      'AI Copilot',
  '/correlation':  'Correlation Engine',
  '/geo':          'Geo Threat Map',
};

export default function TopBar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [time] = useState(() => new Date().toLocaleTimeString());

  const label = ROUTE_LABELS[location.pathname] || 'SENTINAL';
  const path = location.pathname.split('/').filter(Boolean);

  return (
    <header className={styles.topbar}>
      {/* Breadcrumb */}
      <div className={styles.left}>
        <nav className={styles.breadcrumb} aria-label="breadcrumb">
          <Link to="/dashboard" className={styles.crumb}>Home</Link>
          {path.map((seg, i) => (
            <React.Fragment key={seg}>
              <span className={styles.crumbSep}>/</span>
              <span className={i === path.length - 1 ? styles.crumbActive : styles.crumb}>
                {seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')}
              </span>
            </React.Fragment>
          ))}
        </nav>
        <h1 className={styles.pageTitle}>{label}</h1>
      </div>

      {/* Right actions */}
      <div className={styles.right}>
        <span className={styles.clock} aria-label="Current time">{time}</span>

        <button
          className={styles.iconBtn}
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <Link to="/alerts" className={styles.iconBtn} aria-label="Alerts">
          🔔
        </Link>

        <div className={styles.avatar} aria-label="User menu">A</div>
      </div>
    </header>
  );
}
