#!/usr/bin/env bash
# =============================================================================
# SENTINAL — deploy.sh  v4.1
# Production deployment for archijain23/SENTINAL
# Cloud-agnostic: Vultr / AWS EC2 / DigitalOcean / Any Ubuntu 22.04 VM
# =============================================================================
# Usage:
#   curl -s https://raw.githubusercontent.com/archijain23/SENTINAL/main/deploy.sh | bash
#   — OR —
#   bash deploy.sh
#
# IDEMPOTENT: Safe to re-run. Won’t duplicate services, won’t overwrite
#             valid config, won’t break running services.
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Colour palette ─────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Logging helpers ─────────────────────────────────────────────────
DEPLOY_LOG="/var/log/sentinal-deploy.log"
DEPLOY_TS=$(date '+%Y-%m-%d %H:%M:%S')

_log_file() { echo "[$DEPLOY_TS] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }

log()  { echo -e "${GREEN}[✓]${NC} $1"; _log_file "[OK]  $1"; }
info() { echo -e "${BLUE}[→]${NC}  $1"; _log_file "[INFO] $1"; }
warn() { echo -e "${YELLOW}[!]${NC}  $1"; _log_file "[WARN] $1"; }
err()  { echo -e "${RED}[✗]${NC}  $1"; _log_file "[ERR]  $1"; }
section() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  _log_file "=== $1 ==="
}

# ── Trap: catch any unexpected exit ─────────────────────────────────
trap 'err "Deployment failed on line $LINENO. Check $DEPLOY_LOG for details."; exit 1' ERR

# ── Banner ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║          SENTINAL — Production Deploy  v4.1             ║${NC}"
echo -e "${BOLD}${GREEN}║      Vultr · AWS EC2 · DigitalOcean · Ubuntu 22.04      ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
info "Deploy log: $DEPLOY_LOG"
sudo touch "$DEPLOY_LOG" 2>/dev/null && sudo chmod 666 "$DEPLOY_LOG" 2>/dev/null || true

# =============================================================================
# CONFIG
# =============================================================================
GITHUB_REPO="https://github.com/archijain23/SENTINAL.git"
REPO_DIR="${REPO_DIR:-$HOME/SENTINAL}"
FRONTEND_DIR="frontend"
LOGS_DIR="$REPO_DIR/logs"

PM2_SERVICES=(sentinal-gateway sentinal-detection sentinal-pcap sentinal-nexus sentinal-dashboard)

# =============================================================================
# 0 — DETECT PUBLIC IP
# =============================================================================
section "STEP 0: Detecting public IP"

PUBLIC_IP=""
for provider in \
  "http://checkip.amazonaws.com" \
  "https://api.ipify.org" \
  "https://ifconfig.me" \
  "https://icanhazip.com"; do
  PUBLIC_IP=$(curl -s --max-time 5 "$provider" 2>/dev/null | tr -d '[:space:]') || continue
  [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
  PUBLIC_IP=""
done

if [[ -z "$PUBLIC_IP" ]]; then
  warn "Could not auto-detect public IP from any provider."
  read -rp "  ▸ Enter this server's public IP address: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

# =============================================================================
# 1 — SYSTEM DEPENDENCIES
# =============================================================================
section "STEP 1: Installing system dependencies"

export DEBIAN_FRONTEND=noninteractive

info "Updating apt package index..."
sudo apt-get update -qq

# ── Node.js 20 ─────────────────────────────────────────────────────────────────
NODE_MAJOR=20
if ! command -v node &>/dev/null || \
   [[ "$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  info "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs >/dev/null 2>&1
fi
log "Node.js $(node --version)"

# ── Python 3 + build tools + tshark ───────────────────────────────────────────
info "Installing Python3 + build tools + tshark..."
# Pre-answer tshark install prompt (it asks about non-superuser captures)
echo "wireshark-common wireshark-common/install-setuid boolean false" | sudo debconf-set-selections
sudo apt-get install -y \
  python3 python3-venv python3-pip python3-dev \
  build-essential libssl-dev libffi-dev libpcap-dev \
  tshark \
  curl git jq >/dev/null 2>&1
log "Python $(python3 --version)"
log "Build-essential + libpcap + tshark installed"

# ── PM2 ───────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  sudo npm install -g pm2 >/dev/null 2>&1
else
  info "PM2 already installed — upgrading..."
  sudo npm install -g pm2 >/dev/null 2>&1 || true
fi
log "PM2 $(pm2 --version)"

# ── serve ──────────────────────────────────────────────────────────────────────
if ! command -v serve &>/dev/null; then
  info "Installing serve..."
  sudo npm install -g serve >/dev/null 2>&1
fi
log "serve $(serve --version)"

# =============================================================================
# 2 — REPOSITORY: CLONE OR UPDATE
# =============================================================================
section "STEP 2: Repository — clone or pull"

if [[ -d "$REPO_DIR/.git" ]]; then
  info "Repo exists — fetching latest changes..."
  cd "$REPO_DIR"
  git stash --include-untracked >/dev/null 2>&1 || true
  git fetch origin main >/dev/null 2>&1
  git reset --hard origin/main >/dev/null 2>&1
  log "Repository updated to $(git rev-parse --short HEAD)"
else
  info "Cloning repository..."
  git clone "$GITHUB_REPO" "$REPO_DIR"
  cd "$REPO_DIR"
  log "Repository cloned: $(git rev-parse --short HEAD)"
fi
cd "$REPO_DIR"

# =============================================================================
# 3 — PYTHON VIRTUAL ENVIRONMENTS
# =============================================================================
section "STEP 3: Python virtual environments"

setup_venv() {
  local svc_dir=$1 svc_label=$2
  local full_path="$REPO_DIR/$svc_dir"

  if [[ ! -d "$full_path" ]]; then
    warn "Service directory missing: $full_path — skipping"
    return 0
  fi

  info "Setting up venv: $svc_label"
  cd "$full_path"

  if [[ ! -f ".venv/bin/activate" ]]; then
    python3 -m venv .venv
  fi

  .venv/bin/pip install --upgrade pip -q
  [[ -f "requirements.txt" ]] && .venv/bin/pip install -r requirements.txt -q
  log "$svc_label venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/nexus-agent"      "Nexus Agent"

# =============================================================================
# 4 — NODE.JS DEPENDENCIES
# =============================================================================
section "STEP 4: Node.js dependencies"

[[ -f "$REPO_DIR/backend/package.json" ]] && {
  cd "$REPO_DIR/backend"
  npm install --omit=dev --silent
  log "Backend dependencies installed"
  cd "$REPO_DIR"
}

[[ -f "$REPO_DIR/$FRONTEND_DIR/package.json" ]] && {
  cd "$REPO_DIR/$FRONTEND_DIR"
  npm install --silent
  log "Frontend dependencies installed"
  cd "$REPO_DIR"
}

# =============================================================================
# 5 — ENVIRONMENT CONFIGURATION
# =============================================================================
section "STEP 5: Environment configuration"

upsert_env() {
  local file=$1 key=$2 value=$3 force=${4:-false}
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    local existing
    existing=$(grep "^${key}=" "$file" | cut -d'=' -f2-)
    if [[ "$force" == "false" ]] && \
       [[ "$existing" != *"your_"* ]] && \
       [[ "$existing" != *"change_me"* ]] && \
       [[ "$existing" != *"<"* ]] && \
       [[ -n "$existing" ]]; then
      return 0  # Preserve real values
    fi
    sed -i "s|^${key}=.*|${key}=${value}|g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# ── Create .env files if missing ─────────────────────────────────────────────
[[ ! -f "$REPO_DIR/.env" ]] && {
  [[ -f "$REPO_DIR/.env.example" ]] && cp "$REPO_DIR/.env.example" "$REPO_DIR/.env" \
    && info "Copied .env.example → .env" || touch "$REPO_DIR/.env"
}
[[ ! -f "$REPO_DIR/backend/.env" ]] && {
  [[ -f "$REPO_DIR/backend/.env.example" ]] && cp "$REPO_DIR/backend/.env.example" "$REPO_DIR/backend/.env" \
    && info "Copied backend/.env.example → backend/.env" || touch "$REPO_DIR/backend/.env"
}

# ── Generate secrets (only written if placeholders exist) ───────────────────────
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# Infrastructure vars: always force-update
upsert_env "$REPO_DIR/.env" "NODE_ENV"       "production"            "true"
upsert_env "$REPO_DIR/.env" "PUBLIC_URL"     "http://$PUBLIC_IP"     "true"
upsert_env "$REPO_DIR/.env" "HOST"           "0.0.0.0"               "true"
upsert_env "$REPO_DIR/.env" "GATEWAY_PORT"   "3000"                  "true"
upsert_env "$REPO_DIR/.env" "DETECTION_PORT" "8002"                  "true"
upsert_env "$REPO_DIR/.env" "PCAP_PORT"      "8003"                  "true"
upsert_env "$REPO_DIR/.env" "NEXUS_PORT"     "8004"                  "true"
upsert_env "$REPO_DIR/.env" "DASHBOARD_PORT" "5173"                  "true"
upsert_env "$REPO_DIR/.env" "DETECTION_URL"  "http://localhost:8002" "true"
upsert_env "$REPO_DIR/.env" "PCAP_URL"       "http://localhost:8003" "true"
upsert_env "$REPO_DIR/.env" "NEXUS_URL"      "http://localhost:8004" "true"
upsert_env "$REPO_DIR/.env" "GATEWAY_URL"    "http://localhost:3000" "true"
upsert_env "$REPO_DIR/.env" "ENVIRONMENT"    "production"            "true"
upsert_env "$REPO_DIR/.env" "LOG_DIR"        "logs"                  "false"

# Secrets: only write if placeholder/missing (preserve on re-deploy)
upsert_env "$REPO_DIR/.env" "JWT_SECRET"     "$JWT_SECRET"           "false"
upsert_env "$REPO_DIR/.env" "API_SECRET"     "$API_SECRET"           "false"

# Sync live JWT/API secrets to backend .env
LIVE_JWT=$(grep "^JWT_SECRET=" "$REPO_DIR/.env" | cut -d'=' -f2-)
LIVE_API=$(grep "^API_SECRET=" "$REPO_DIR/.env" | cut -d'=' -f2-)
upsert_env "$REPO_DIR/backend/.env" "JWT_SECRET" "$LIVE_JWT"  "true"
upsert_env "$REPO_DIR/backend/.env" "API_SECRET" "$LIVE_API"  "true"
upsert_env "$REPO_DIR/backend/.env" "NODE_ENV"   "production" "true"
upsert_env "$REPO_DIR/backend/.env" "PORT"       "3000"       "true"

# ── MongoDB URI prompt ──────────────────────────────────────────────────────
CURRENT_MONGO=$(grep "^MONGO_URI=" "$REPO_DIR/.env" 2>/dev/null | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_MONGO" ]] || [[ "$CURRENT_MONGO" == *"username:password"* ]] || \
   [[ "$CURRENT_MONGO" == *"change_me"* ]] || [[ "$CURRENT_MONGO" == *"<"* ]]; then
  echo ""
  warn "MONGO_URI is not configured."
  read -rp "  ▸ MongoDB Atlas URI (press Enter to skip): " MONGO_URI_INPUT
  if [[ -n "$MONGO_URI_INPUT" ]]; then
    upsert_env "$REPO_DIR/.env"         "MONGO_URI" "$MONGO_URI_INPUT" "true"
    # FIX: re-sync to backend/.env immediately after prompt (was missing before)
    upsert_env "$REPO_DIR/backend/.env" "MONGO_URI" "$MONGO_URI_INPUT" "true"
    log "MONGO_URI saved to root .env and backend/.env"
  else
    warn "MONGO_URI skipped — set it manually in $REPO_DIR/.env and $REPO_DIR/backend/.env"
  fi
else
  # Also sync existing valid value to backend/.env
  upsert_env "$REPO_DIR/backend/.env" "MONGO_URI" "$CURRENT_MONGO" "true"
  log "MONGO_URI already configured — preserved and synced to backend/.env"
fi

# ── Optional API keys: warn if still placeholder ─────────────────────────────
CURRENT_GEMINI=$(grep "^GEMINI_API_KEY=" "$REPO_DIR/.env" 2>/dev/null | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_GEMINI" ]] || [[ "$CURRENT_GEMINI" == *"your_"* ]]; then
  warn "GEMINI_API_KEY not set — Nexus AI features will be disabled."
  warn "Set it later: echo 'GEMINI_API_KEY=your_key' >> $REPO_DIR/.env"
fi

CURRENT_ABUSE=$(grep "^ABUSEIPDB_API_KEY=" "$REPO_DIR/.env" 2>/dev/null | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_ABUSE" ]] || [[ "$CURRENT_ABUSE" == *"your_"* ]]; then
  warn "ABUSEIPDB_API_KEY not set — IP reputation scoring will be skipped."
  warn "Set it later: echo 'ABUSEIPDB_API_KEY=your_key' >> $REPO_DIR/.env"
fi

log ".env configuration complete"

# =============================================================================
# 6 — BUILD REACT FRONTEND
# =============================================================================
section "STEP 6: Building React frontend (Vite)"

FRONTEND_PATH="$REPO_DIR/$FRONTEND_DIR"
FRONTEND_DIST="$FRONTEND_PATH/dist"

cat > "$FRONTEND_PATH/.env.production" <<EOF
VITE_API_URL=http://${PUBLIC_IP}:3000
VITE_SOCKET_URL=http://${PUBLIC_IP}:3000
VITE_WS_URL=ws://${PUBLIC_IP}:3000
EOF
log "frontend/.env.production written"

cd "$FRONTEND_PATH"
info "Running npm run build..."
npm run build 2>&1 | tee -a "$DEPLOY_LOG"

[[ ! -f "$FRONTEND_DIST/index.html" ]] && {
  err "Vite build failed — dist/index.html not found!"
  exit 1
}
log "Frontend build verified: $FRONTEND_DIST"
cd "$REPO_DIR"

# =============================================================================
# 7 — LOGS DIRECTORY
# =============================================================================
# Create before PM2 ecosystem generation so log paths always exist
mkdir -p "$LOGS_DIR"
log "Logs directory: $LOGS_DIR"

# =============================================================================
# 8 — GENERATE PM2 ECOSYSTEM
# =============================================================================
section "STEP 8: Generating PM2 ecosystem.config.js"

cat > "$REPO_DIR/ecosystem.config.js" <<JSEOF
'use strict';
// Auto-generated by deploy.sh on $(date '+%Y-%m-%d %H:%M:%S')
const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [
    {
      name: 'sentinal-gateway',
      script: path.join(root, 'backend', 'server.js'),
      cwd: path.join(root, 'backend'),
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 15, min_uptime: '5s',
      restart_delay: 5000, kill_timeout: 5000,
      env: { NODE_ENV: 'production', PORT: '3000', NODE_OPTIONS: '--max-old-space-size=512' },
      env_file: path.join(root, '.env'),
      out_file: path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss', merge_logs: false,
    },
    {
      name: 'sentinal-detection',
      script: path.join(root, 'services', 'detection-engine', '.venv', 'bin', 'python3'),
      args: '-m uvicorn app.main:app --host 0.0.0.0 --port 8002 --no-access-log --workers 1',
      cwd: path.join(root, 'services', 'detection-engine'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 15, min_uptime: '5s',
      restart_delay: 5000, kill_timeout: 8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_file: path.join(root, '.env'),
      out_file: path.join(root, 'logs', 'detection.out.log'),
      error_file: path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss', merge_logs: false,
    },
    {
      name: 'sentinal-pcap',
      script: path.join(root, 'services', 'pcap-processor', '.venv', 'bin', 'python3'),
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8003 --no-access-log --workers 1',
      cwd: path.join(root, 'services', 'pcap-processor'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 15, min_uptime: '5s',
      restart_delay: 5000, kill_timeout: 8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_file: path.join(root, '.env'),
      out_file: path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss', merge_logs: false,
    },
    {
      name: 'sentinal-nexus',
      script: path.join(root, 'services', 'nexus-agent', '.venv', 'bin', 'python3'),
      args: '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log --workers 1',
      cwd: path.join(root, 'services', 'nexus-agent'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 15, min_uptime: '5s',
      restart_delay: 5000, kill_timeout: 8000,
      env: { PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
      env_file: path.join(root, '.env'),
      out_file: path.join(root, 'logs', 'nexus.out.log'),
      error_file: path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss', merge_logs: false,
    },
    {
      name: 'sentinal-dashboard',
      script: 'serve',
      args: '${FRONTEND_DIST} --listen 5173 --single',
      cwd: root,
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 15, min_uptime: '5s',
      restart_delay: 3000, kill_timeout: 5000,
      env: { NODE_ENV: 'production' },
      out_file: path.join(root, 'logs', 'dashboard.out.log'),
      error_file: path.join(root, 'logs', 'dashboard.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss', merge_logs: false,
    },
  ],
};
JSEOF
log "ecosystem.config.js generated"

# =============================================================================
# 9 — START / RELOAD SERVICES
# =============================================================================
section "STEP 9: Starting services with PM2"
cd "$REPO_DIR"

if pm2 list 2>/dev/null | grep -q "sentinal-gateway"; then
  info "Services running — performing zero-downtime reload..."
  pm2 reload ecosystem.config.js --update-env
  log "All services reloaded with zero downtime"
else
  info "Starting services for the first time..."
  pm2 start ecosystem.config.js
  log "All 5 services started"
fi

# =============================================================================
# 10 — PM2 STARTUP PERSISTENCE
# =============================================================================
section "STEP 10: PM2 startup on reboot"

CURRENT_USER=$(whoami)
PM2_STARTUP_CMD=$(pm2 startup systemd -u "$CURRENT_USER" --hp "$HOME" 2>/dev/null \
  | grep "sudo env" | head -1 || true)

[[ -n "$PM2_STARTUP_CMD" ]] && eval "$PM2_STARTUP_CMD" >/dev/null 2>&1 || \
  sudo systemctl enable "pm2-${CURRENT_USER}" >/dev/null 2>&1 || true

pm2 save --force >/dev/null 2>&1
log "PM2 startup configured — survives reboots"

# =============================================================================
# 11 — UFW FIREWALL
# =============================================================================
section "STEP 11: UFW firewall"
if command -v ufw &>/dev/null; then
  for port_comment in "22/tcp:SSH" "3000/tcp:Gateway" "5173/tcp:Dashboard" \
                      "8002/tcp:Detection" "8003/tcp:PCAP" "8004/tcp:Nexus"; do
    port="${port_comment%%:*}"; comment="${port_comment##*:}"
    sudo ufw allow "$port" comment "SENTINAL $comment" >/dev/null 2>&1 || true
  done
  sudo ufw status | grep -q "Status: active" || echo "y" | sudo ufw enable >/dev/null 2>&1 || true
  log "UFW rules applied"
else
  warn "UFW not found — skipping firewall (install: sudo apt install ufw)"
fi

# =============================================================================
# 12 — HEALTH CHECKS
# =============================================================================
section "STEP 12: Health checks"
HEALTH_WAIT=15
info "Waiting ${HEALTH_WAIT}s for services to initialise..."
sleep "$HEALTH_WAIT"

HEALTH_PASS=0; HEALTH_FAIL=0; FAILED_SERVICES=()

check_health() {
  local name=$1 url=$2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
         --retry 2 --retry-delay 3 "$url" 2>/dev/null || echo "000")
  if [[ "$code" == "200" ]]; then
    log "  $name  →  $url  →  HTTP $code ✓"; (( HEALTH_PASS++ )) || true
  else
    err "  $name  →  $url  →  HTTP $code ✗"; FAILED_SERVICES+=("$name")
    (( HEALTH_FAIL++ )) || true
  fi
}

check_health "sentinal-gateway   " "http://localhost:3000/health"
check_health "sentinal-detection " "http://localhost:8002/health"
check_health "sentinal-pcap      " "http://localhost:8003/health"
check_health "sentinal-nexus     " "http://localhost:8004/health"
check_health "sentinal-dashboard " "http://localhost:5173"

# =============================================================================
# 13 — PM2 LOG ROTATION
# =============================================================================
section "STEP 13: PM2 log rotation"
pm2 list 2>/dev/null | grep -q "pm2-logrotate" || {
  pm2 install pm2-logrotate >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:max_size 10M  >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:retain 7      >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:compress true >/dev/null 2>&1 || true
  log "Log rotation: 10MB max, 7 days, gzip"
}

# =============================================================================
# DONE
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║            SENTINAL DEPLOYMENT COMPLETE  ✓              ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}          http://${PUBLIC_IP}:5173"
echo -e "  ${BOLD}Gateway API:${NC}       http://${PUBLIC_IP}:3000"
echo -e "  ${BOLD}Detection Engine:${NC}  http://${PUBLIC_IP}:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}    http://${PUBLIC_IP}:8003"
echo -e "  ${BOLD}Nexus Agent:${NC}       http://${PUBLIC_IP}:8004"
echo ""
echo -e "  ${BOLD}pm2 list${NC}    │  ${BOLD}pm2 monit${NC}    │  ${BOLD}pm2 logs <name>${NC}"
echo ""
warn "  Add $PUBLIC_IP to MongoDB Atlas Network Access!"
echo ""
[[ $HEALTH_FAIL -gt 0 ]] && warn "⚠  $HEALTH_FAIL service(s) failed health checks: ${FAILED_SERVICES[*]}"
