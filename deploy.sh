#!/bin/bash
# =============================================================================
# SENTINAL — deploy.sh  v3.0
# Production deployment for archijain23/SENTINAL
# Vultr / AWS / Any fresh Ubuntu 22.04 instance
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo -e "\n${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     SENTINAL — Auto Deploy Script v3.0       ║${NC}"
echo -e "${BOLD}║     Vultr / AWS / Ubuntu 22.04 Edition       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
GITHUB_REPO="https://github.com/archijain23/SENTINAL.git"
REPO_DIR="$HOME/SENTINAL"
FRONTEND_DIR="frontend"   # Vite app lives in frontend/

# ---------------------------------------------------------------------------
# Detect public IP
# ---------------------------------------------------------------------------
info "Detecting public IP..."
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null ||
            curl -s --max-time 5 https://api.ipify.org          2>/dev/null ||
            curl -s --max-time 5 https://ifconfig.me            2>/dev/null)
if [ -z "$PUBLIC_IP" ]; then
  warn "Could not auto-detect IP."
  read -rp "Enter this server's public IP: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

# ===========================================================================
# STEP 1 — System dependencies
# ===========================================================================
echo -e "\n${BOLD}── STEP 1: Installing system dependencies ──${NC}"
sudo apt-get update -qq

if ! command -v node &>/dev/null; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs >/dev/null 2>&1
fi
log "Node.js $(node --version)"

sudo apt-get install -y python3 python3-venv python3-pip python3-dev >/dev/null 2>&1
log "Python $(python3 --version)"

sudo apt-get install -y build-essential libssl-dev libffi-dev libpcap-dev >/dev/null 2>&1
log "Build tools + libpcap installed"

if ! command -v pm2 &>/dev/null; then
  sudo npm install -g pm2 >/dev/null 2>&1
fi
log "PM2 $(pm2 --version)"

if ! command -v serve &>/dev/null; then
  sudo npm install -g serve >/dev/null 2>&1
fi
log "serve $(serve --version)"

# ===========================================================================
# STEP 2 — Clone or update repository
# ===========================================================================
echo -e "\n${BOLD}── STEP 2: Cloning repository ──${NC}"
if [ -d "$REPO_DIR/.git" ]; then
  info "Repo exists — pulling latest..."
  cd "$REPO_DIR" && git pull origin main
else
  git clone "$GITHUB_REPO" "$REPO_DIR"
fi
cd "$REPO_DIR"
log "Repo cloned: $GITHUB_REPO"

# ===========================================================================
# STEP 3 — Python virtual environments
# ===========================================================================
echo -e "\n${BOLD}── STEP 3: Setting up Python virtual environments ──${NC}"
setup_venv() {
  local svc_dir=$1 svc_name=$2
  info "Setting up venv for $svc_name..."
  cd "$REPO_DIR/$svc_dir"
  [ ! -d ".venv" ] && python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  deactivate
  log "$svc_name venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/nexus-agent"      "Nexus Agent"
setup_venv "services/response-engine"  "Response Engine"

# ===========================================================================
# STEP 4 — Node.js dependencies
# ===========================================================================
echo -e "\n${BOLD}── STEP 4: Installing Node.js dependencies ──${NC}"
cd "$REPO_DIR/backend"       && npm install --omit=dev --silent
log "Backend deps installed"
cd "$REPO_DIR/$FRONTEND_DIR" && npm install --silent
log "Frontend deps installed"
cd "$REPO_DIR"

# ===========================================================================
# STEP 5 — Environment configuration
# ===========================================================================
echo -e "\n${BOLD}── STEP 5: Environment configuration ──${NC}"

if [ ! -f "$REPO_DIR/.env" ]; then
  [ -f "$REPO_DIR/.env.example" ] && cp "$REPO_DIR/.env.example" "$REPO_DIR/.env" && info "Copied .env.example → .env" || touch "$REPO_DIR/.env"
fi

if [ ! -f "$REPO_DIR/backend/.env" ]; then
  [ -f "$REPO_DIR/backend/.env.example" ] && cp "$REPO_DIR/backend/.env.example" "$REPO_DIR/backend/.env" && info "Copied backend/.env.example → backend/.env" || touch "$REPO_DIR/backend/.env"
fi

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

upsert_env() {
  local file=$1 k=$2 v=$3
  if grep -q "^${k}=" "$file" 2>/dev/null; then
    sed -i "s|^${k}=.*|${k}=${v}|g" "$file"
  else
    echo "${k}=${v}" >> "$file"
  fi
}

upsert_env "$REPO_DIR/.env" PUBLIC_URL     "http://$PUBLIC_IP"
upsert_env "$REPO_DIR/.env" NODE_ENV       production
upsert_env "$REPO_DIR/.env" JWT_SECRET     "$JWT_SECRET"
upsert_env "$REPO_DIR/.env" API_SECRET     "$API_SECRET"
upsert_env "$REPO_DIR/.env" GATEWAY_PORT   3000
upsert_env "$REPO_DIR/.env" DETECTION_PORT 8002
upsert_env "$REPO_DIR/.env" PCAP_PORT      8003
upsert_env "$REPO_DIR/.env" NEXUS_PORT     8004
upsert_env "$REPO_DIR/.env" DASHBOARD_PORT 5173
upsert_env "$REPO_DIR/.env" DETECTION_URL  http://localhost:8002
upsert_env "$REPO_DIR/.env" PCAP_URL       http://localhost:8003
upsert_env "$REPO_DIR/.env" NEXUS_URL      http://localhost:8004
upsert_env "$REPO_DIR/.env" GATEWAY_URL    http://localhost:3000

upsert_env "$REPO_DIR/backend/.env" JWT_SECRET "$JWT_SECRET"
upsert_env "$REPO_DIR/backend/.env" API_SECRET "$API_SECRET"
upsert_env "$REPO_DIR/backend/.env" NODE_ENV   production
upsert_env "$REPO_DIR/backend/.env" PORT       3000

CURRENT_MONGO=$(grep '^MONGO_URI=' "$REPO_DIR/.env" 2>/dev/null | cut -d'=' -f2- || true)
if [ -z "$CURRENT_MONGO" ] || [[ "$CURRENT_MONGO" == *"your_mongo"* ]] || [[ "$CURRENT_MONGO" == *"<"* ]]; then
  echo ""
  warn "MONGO_URI is not set."
  read -rp "  Paste your MongoDB Atlas URI: " MONGO_URI_INPUT
  upsert_env "$REPO_DIR/.env"         MONGO_URI "$MONGO_URI_INPUT"
  upsert_env "$REPO_DIR/backend/.env" MONGO_URI "$MONGO_URI_INPUT"
  log "MONGO_URI saved"
else
  log "MONGO_URI already configured"
fi
log ".env files ready"

# ===========================================================================
# STEP 6 — Build React frontend
# ===========================================================================
echo -e "\n${BOLD}── STEP 6: Building React frontend (Vite) ──${NC}"

cat > "$REPO_DIR/$FRONTEND_DIR/.env.production" <<EOF
VITE_API_URL=http://$PUBLIC_IP:3000
VITE_SOCKET_URL=http://$PUBLIC_IP:3000
VITE_WS_URL=ws://$PUBLIC_IP:3000
EOF
log "$FRONTEND_DIR/.env.production written"

cd "$REPO_DIR/$FRONTEND_DIR"
info "Building Vite app — may take 1-2 minutes..."
npm run build
cd "$REPO_DIR"

FRONTEND_DIST="$REPO_DIR/$FRONTEND_DIR/dist"
if [ ! -f "$FRONTEND_DIST/index.html" ]; then
  err "Build failed — $FRONTEND_DIST/index.html not found!"
  exit 1
fi
log "Build verified ✓  ($FRONTEND_DIST)"

# ===========================================================================
# STEP 7 — Write PM2 ecosystem
# ===========================================================================
echo -e "\n${BOLD}── STEP 7: Writing PM2 ecosystem ──${NC}"

cat > "$REPO_DIR/ecosystem.config.js" <<JSEOF
'use strict';
const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [

    // 1 — Gateway  (Node.js / Express  — port 3000)
    {
      name:        'sentinal-gateway',
      script:      path.join(root, 'backend', 'server.js'),
      cwd:         path.join(root, 'backend'),
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { NODE_ENV: 'production', PORT: '3000' },
      out_file:   path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 2 — Detection Engine  (Python / FastAPI  — port 8002)
    {
      name:        'sentinal-detection',
      script:      path.join(root, 'services', 'detection-engine', '.venv', 'bin', 'python3'),
      args:        '-m uvicorn app.main:app --host 0.0.0.0 --port 8002 --no-access-log',
      cwd:         path.join(root, 'services', 'detection-engine'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'detection.out.log'),
      error_file: path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 3 — PCAP Processor  (Python / FastAPI  — port 8003)
    {
      name:        'sentinal-pcap',
      script:      path.join(root, 'services', 'pcap-processor', '.venv', 'bin', 'python3'),
      args:        '-m uvicorn main:app --host 0.0.0.0 --port 8003 --no-access-log',
      cwd:         path.join(root, 'services', 'pcap-processor'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 4 — Nexus Agent  (Python / FastAPI  — port 8004)
    {
      name:        'sentinal-nexus',
      script:      path.join(root, 'services', 'nexus-agent', '.venv', 'bin', 'python3'),
      args:        '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log',
      cwd:         path.join(root, 'services', 'nexus-agent'),
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'nexus.out.log'),
      error_file: path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 5 — React Frontend  (serve v14+  — port 5173)
    {
      name:        'sentinal-dashboard',
      script:      'serve',
      args:        '${FRONTEND_DIST} --listen 5173 --single',
      cwd:         root,
      interpreter: 'none',
      instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { NODE_ENV: 'production' },
      out_file:   path.join(root, 'logs', 'dashboard.out.log'),
      error_file: path.join(root, 'logs', 'dashboard.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

  ],
};
JSEOF
log "ecosystem.config.js written (5 services)"

# ===========================================================================
# STEP 8 — Start all services
# ===========================================================================
echo -e "\n${BOLD}── STEP 8: Starting all services with PM2 ──${NC}"
mkdir -p "$REPO_DIR/logs"
pm2 delete all >/dev/null 2>&1 || true
cd "$REPO_DIR"
pm2 start ecosystem.config.js
log "All 5 services started"

# ===========================================================================
# STEP 9 — PM2 startup on reboot
# ===========================================================================
echo -e "\n${BOLD}── STEP 9: Configuring PM2 startup on reboot ──${NC}"
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 ||
  systemctl enable pm2-root              >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1
log "PM2 startup configured — services survive reboots"

# ===========================================================================
# STEP 10 — Health checks
# ===========================================================================
echo -e "\n${BOLD}── STEP 10: Health checks (waiting 12s) ──${NC}"
sleep 12

check_health() {
  local name=$1 url=$2 code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$url")
  [ "$code" = "200" ] && log "$name → HTTP 200 ✓" || err "$name → HTTP $code ✗  — run: pm2 logs $name"
}

check_health sentinal-gateway   http://localhost:3000/health
check_health sentinal-detection http://localhost:8002/health
check_health sentinal-pcap      http://localhost:8003/health
check_health sentinal-nexus     http://localhost:8004/health
check_health sentinal-dashboard http://localhost:5173

# ===========================================================================
# Done
# ===========================================================================
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn " Add your server IP to MongoDB Atlas Network Access!"
warn " Atlas → Network Access → Add IP → $PUBLIC_IP"
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║       SENTINAL DEPLOY COMPLETE ✓             ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Frontend:${NC}         http://$PUBLIC_IP:5173"
echo -e "  ${BOLD}Gateway API:${NC}      http://$PUBLIC_IP:3000"
echo -e "  ${BOLD}Detection Engine:${NC} http://$PUBLIC_IP:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}   http://$PUBLIC_IP:8003"
echo -e "  ${BOLD}Nexus Agent:${NC}      http://$PUBLIC_IP:8004"
echo ""
echo -e "  ${BOLD}pm2 list${NC}          — check all 5 services"
echo -e "  ${BOLD}pm2 monit${NC}         — live CPU/RAM dashboard"
echo -e "  ${BOLD}pm2 logs <name>${NC}   — tail logs"
echo -e "  ${BOLD}pm2 restart all${NC}   — restart everything"
echo ""
