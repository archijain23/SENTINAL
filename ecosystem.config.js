/**
 * ecosystem.config.js — PM2 Process Manager Configuration
 * =========================================================
 * Manages all 5 SENTINAL services as a single process group.
 *
 * USAGE:
 *   pm2 start ecosystem.config.js          # start all services
 *   pm2 stop ecosystem.config.js           # stop all services
 *   pm2 restart ecosystem.config.js        # restart all services
 *   pm2 logs                               # tail all logs
 *   pm2 monit                              # live CPU/memory dashboard
 *
 * NOTE: Python services use .venv/bin/python3 (NOT system python3).
 *       Run deploy.sh first to create the venvs and install packages.
 */

'use strict';

const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [

    // ── 1. Gateway (Node.js / Express) ─────────────────────────────────────
    {
      name:          'sentinal-gateway',
      script:        path.join(root, 'backend', 'server.js'),
      cwd:           path.join(root, 'backend'),
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      autorestart:   true,
      max_restarts:  15,
      min_uptime:    '5s',
      restart_delay: 5000,
      kill_timeout:  5000,
      env: { NODE_ENV: 'production', PORT: '3000', NODE_OPTIONS: '--max-old-space-size=512' },
      env_development: { NODE_ENV: 'development', PORT: '3000' },
      out_file:        path.join(root, 'logs', 'gateway.out.log'),
      error_file:      path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── 2. Detection Engine (Python / FastAPI / Uvicorn) ───────────────────
    // FIX: script points to .venv/bin/python3, NOT system python3
    // FIX: port is hardcoded 8002 — PM2 does not expand ${VAR:-default}
    {
      name:          'sentinal-detection',
      script:        path.join(root, 'services', 'detection-engine', '.venv', 'bin', 'python3'),
      args:          '-m uvicorn app.main:app --host 0.0.0.0 --port 8002 --no-access-log --workers 1',
      cwd:           path.join(root, 'services', 'detection-engine'),
      interpreter:   'none',
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      autorestart:   true,
      max_restarts:  15,
      min_uptime:    '5s',
      restart_delay: 5000,
      kill_timeout:  8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_development: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      out_file:        path.join(root, 'logs', 'detection.out.log'),
      error_file:      path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── 3. PCAP Processor (Python / FastAPI / Uvicorn) ────────────────────
    // FIX: script points to .venv/bin/python3, NOT system python3
    // FIX: port is hardcoded 8003
    {
      name:          'sentinal-pcap',
      script:        path.join(root, 'services', 'pcap-processor', '.venv', 'bin', 'python3'),
      args:          '-m uvicorn main:app --host 0.0.0.0 --port 8003 --no-access-log --workers 1',
      cwd:           path.join(root, 'services', 'pcap-processor'),
      interpreter:   'none',
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      autorestart:   true,
      max_restarts:  15,
      min_uptime:    '5s',
      restart_delay: 5000,
      kill_timeout:  8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_development: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      out_file:        path.join(root, 'logs', 'pcap.out.log'),
      error_file:      path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── 4. Nexus Agent (Python / FastAPI / Uvicorn) ───────────────────────
    // FIX: script points to .venv/bin/python3, NOT system python3
    // FIX: port is hardcoded 8004
    {
      name:          'sentinal-nexus',
      script:        path.join(root, 'services', 'nexus-agent', '.venv', 'bin', 'python3'),
      args:          '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log --workers 1',
      cwd:           path.join(root, 'services', 'nexus-agent'),
      interpreter:   'none',
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      autorestart:   true,
      max_restarts:  15,
      min_uptime:    '5s',
      restart_delay: 5000,
      kill_timeout:  8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_development: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      out_file:        path.join(root, 'logs', 'nexus.out.log'),
      error_file:      path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

  ],
};
