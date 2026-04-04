import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Sidebar.module.css';

const NAV = [
  { group: 'Overview', items: [
    { to: '/dashboard',    icon: '⬡', label: 'Dashboard' },
    { to: '/explore',      icon: '◎', label: 'Explore' },
    { to: '/geo',          icon: '🌐', label: 'Geo Map' },
  ]},
  { group: 'Threats', items: [
    { to: '/attacks',      icon: '⚡', label: 'Attacks' },
    { to: '/alerts',       icon: '🔔', label: 'Alerts' },
    { to: '/logs',         icon: '📋', label: 'Logs' },
  ]},
  { group: 'Response', items: [
    { to: '/action-queue', icon: '⏳', label: 'Action Queue' },
    { to: '/blocklist',    icon: '🛡', label: 'Blocklist' },
    { to: '/simulate',     icon: '🧪', label: 'Simulate' },
  ]},
  { group: 'Analysis', items: [
    { to: '/pcap',         icon: '📁', label: 'PCAP Analyzer' },
    { to: '/audit',        icon: '📝', label: 'Audit Log' },
    { to: '/correlation',  icon: '🔗', label: 'Correlation' },
  ]},
  { group: 'AI', items: [
    { to: '/copilot',      icon: '✦', label: 'AI Copilot' },
  ]},
  { group: 'System', items: [
    { to: '/services',     icon: '⚙', label: 'Services' },
    { to: '/settings',     icon: '⚙', label: 'Settings' },
    { to: '/docs',         icon: '?', label: 'Docs' },
  ]},
];

export default function Sidebar({ collapsed, onToggle }) {
  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      {/* Logo */}
      <div className={styles.logo}>
        <span className={styles.logoMark}>S</span>
        {!collapsed && <span className={styles.logoText}>SENTINAL</span>}
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {NAV.map(group => (
          <div key={group.group} className={styles.group}>
            {!collapsed && <span className={styles.groupLabel}>{group.group}</span>}
            {group.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                title={collapsed ? item.label : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Toggle */}
      <button className={styles.toggleBtn} onClick={onToggle} aria-label="Toggle sidebar">
        {collapsed ? '›' : '‹'}
      </button>
    </aside>
  );
}
