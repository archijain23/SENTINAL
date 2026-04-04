import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import styles from './TopBar.module.css';

const ROUTE_LABELS = {
  '/app/dashboard':    { label: 'Dashboard',        icon: '⬡' },
  '/app/explore':      { label: 'Explore',           icon: '◎' },
  '/app/geo':          { label: 'Geo Threat Map',    icon: '🌐' },
  '/app/threats':      { label: 'Attack Monitor',    icon: '⚡' },
  '/app/alerts':       { label: 'Alert Center',      icon: '🔔' },
  '/app/logs':         { label: 'System Logs',       icon: '📋' },
  '/app/action-queue': { label: 'Action Queue',      icon: '⏳' },
  '/app/blocklist':    { label: 'IP Blocklist',      icon: '🛡' },
  '/app/simulate':     { label: 'Attack Simulator',  icon: '🧪' },
  '/app/pcap':         { label: 'PCAP Analyzer',     icon: '📁' },
  '/app/audit':        { label: 'Audit Log',         icon: '📝' },
  '/app/correlation':  { label: 'Correlation Engine',icon: '🔗' },
  '/app/copilot':      { label: 'AI Copilot',        icon: '✦' },
  '/app/services':     { label: 'Services',          icon: '⚙' },
  '/app/settings':     { label: 'Settings',          icon: '⚙' },
};

export default function TopBar() {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour12: false }));

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Match route — handle dynamic segments like /app/threats/:id
  const basePath = '/' + location.pathname.split('/').slice(1, 3).join('/');
  const routeInfo = ROUTE_LABELS[basePath] || { label: 'SENTINAL', icon: '◈' };

  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <nav className={styles.breadcrumb} aria-label="breadcrumb">
          <Link to="/app/dashboard" className={styles.crumb}>Home</Link>
          {segments.slice(1).map((seg, i) => (
            <React.Fragment key={seg}>
              <span className={styles.crumbSep}>/</span>
              <span className={i === segments.length - 2 ? styles.crumbActive : styles.crumb}>
                {seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')}
              </span>
            </React.Fragment>
          ))}
        </nav>
        <h1 className={styles.pageTitle}>{routeInfo.label}</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.statusDot} title="System online">
          <span className={styles.dot} />
          <span className={styles.statusText}>LIVE</span>
        </div>

        <span className={styles.clock} aria-label="Current time">
          {time}
        </span>

        <button
          className={styles.iconBtn}
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
        </button>

        <Link to="/app/alerts" className={styles.iconBtn} aria-label="Alerts">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </Link>

        <div className={styles.avatar} aria-label="User">A</div>
      </div>
    </header>
  );
}
