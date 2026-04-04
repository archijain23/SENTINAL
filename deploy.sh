#!/bin/bash
# =============================================================================
# SENTINAL — deploy.sh  v2.0
# One-command full deployment — Vultr / AWS / Any fresh Ubuntu 22.04 instance
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
echo -e "${BOLD}║     SENTINAL — Auto Deploy Script v2.0       ║${NC}"
echo -e "${BOLD}║     Vultr / AWS / Ubuntu 22.04 Edition       ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}\n"

# ── Detect public IP (works on Vultr, AWS, and any cloud) ──────────────────
info "Detecting public IP..."
PUBLIC_IP=$(curl -s --max-time 5 http://checkip.amazonaws.com 2>/dev/null || \
            curl -s --max-time 5 https://api.ipify.org 2>/dev/null || \
            curl -s --max-time 5 https://ifconfig.me 2>/dev/null)
if [ -z "$PUBLIC_IP" ]; then
  warn "Could not auto-detect IP."
  read -p "Enter this server's public IP: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

# ── STEP 1: System dependencies ────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 1: Installing system dependencies ──${NC}"
sudo apt-get update -qq
if ! command -v node &> /dev/null; then
  info "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
fi
log "Node.js $(node --version)"
sudo apt-get install -y python3 python3-venv python3-pip python3-dev > /dev/null 2>&1
log "Python $(python3 --version)"
sudo apt-get install -y build-essential libssl-dev libffi-dev libpcap-dev > /dev/null 2>&1
log "Build tools + libpcap installed"
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2 > /dev/null 2>&1
fi
log "PM2 $(pm2 --version)"
if ! command -v serve &> /dev/null; then
  sudo npm install -g serve > /dev/null 2>&1
fi
log "serve installed"

# ── STEP 2: Clone or update repository ─────────────────────────────────────
echo -e "\n${BOLD}── STEP 2: Cloning repository ──${NC}"
REPO_DIR="$HOME/SENTINAL"
if [ -d "$REPO_DIR/.git" ]; then
  info "Repo exists — pulling latest..."
  cd "$REPO_DIR" && git pull origin main
else
  git clone https://github.com/ayushtiwari18/SENTINAL.git "$REPO_DIR"
fi
cd "$REPO_DIR"
log "Repo ready at $REPO_DIR"

# ── STEP 3: Python virtual environments ────────────────────────────────────
echo -e "\n${BOLD}── STEP 3: Setting up Python virtual environments ──${NC}"
setup_venv() {
  local SERVICE_DIR=$1
  local SERVICE_NAME=$2
  info "Setting up venv for $SERVICE_NAME..."
  cd "$REPO_DIR/$SERVICE_DIR"
  if [ ! -d ".venv" ]; then python3 -m venv .venv; fi
  source .venv/bin/activate
  pip install --upgrade pip -q
  pip install -r requirements.txt -q
  deactivate
  log "$SERVICE_NAME venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/nexus-agent"      "Nexus Agent"

# ── STEP 4: Node.js dependencies ───────────────────────────────────────────
echo -e "\n${BOLD}── STEP 4: Installing Node.js dependencies ──${NC}"
cd "$REPO_DIR/backend" && npm install --omit=dev --silent
log "Backend deps installed"

# Frontend is in frontend/ directory
cd "$REPO_DIR/frontend" && npm install --silent
log "Frontend deps installed"
cd "$REPO_DIR"

# ── STEP 5: Environment configuration ──────────────────────────────────────
echo -e "\n${BOLD}── STEP 5: Environment configuration ──${NC}"
if [ ! -f "$REPO_DIR/.env" ]; then
  if [ -f "$REPO_DIR/.env.example" ]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    info "Copied .env.example → .env"
  else
    touch "$REPO_DIR/.env"
    info "Created empty .env"
  fi
fi

# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Update or append each key safely
upsert_env() {
  local KEY=$1 VAL=$2
  if grep -q "^${KEY}=" "$REPO_DIR/.env"; then
    sed -i "s|^${KEY}=.*|${KEY}=${VAL}|g" "$REPO_DIR/.env"
  else
    echo "${KEY}=${VAL}" >> "$REPO_DIR/.env"
  fi
}

upsert_env "PUBLIC_URL"      "http://$PUBLIC_IP"
upsert_env "NODE_ENV"        "production"
upsert_env "JWT_SECRET"      "$JWT_SECRET"
upsert_env "API_SECRET"      "$API_SECRET"
upsert_env "GATEWAY_PORT"    "3000"
upsert_env "DETECTION_PORT"  "8002"
upsert_env "PCAP_PORT"       "8003"
upsert_env "NEXUS_PORT"      "8004"
upsert_env "DASHBOARD_PORT"  "5173"
upsert_env "DETECTION_URL"   "http://localhost:8002"
upsert_env "PCAP_URL"        "http://localhost:8003"
upsert_env "NEXUS_URL"       "http://localhost:8004"
upsert_env "GATEWAY_URL"     "http://localhost:3000"

# MongoDB URI prompt if not set
CURRENT_MONGO=$(grep '^MONGO_URI=' "$REPO_DIR/.env" 2>/dev/null | cut -d'=' -f2- || echo "")
if [ -z "$CURRENT_MONGO" ] || [ "$CURRENT_MONGO" = "your_mongo_uri_here" ] || [[ "$CURRENT_MONGO" == *"<"* ]]; then
  echo ""
  warn "MONGO_URI is not set. Enter it now."
  read -p "  Paste your MONGO_URI: " MONGO_URI_INPUT
  upsert_env "MONGO_URI" "$MONGO_URI_INPUT"
  log "MONGO_URI saved"
else
  log "MONGO_URI already configured"
fi
log ".env configured"

# ── STEP 6: Build React dashboard (frontend/) ──────────────────────────────
echo -e "\n${BOLD}── STEP 6: Configuring and building frontend ──${NC}"
cat > "$REPO_DIR/frontend/.env.production" << EOF
VITE_API_URL=http://$PUBLIC_IP:3000
VITE_SOCKET_URL=http://$PUBLIC_IP:3000
VITE_WS_URL=ws://$PUBLIC_IP:3000
EOF
log "frontend/.env.production → http://$PUBLIC_IP:3000"

cd "$REPO_DIR/frontend"
npm run build > /dev/null 2>&1
log "Frontend built → frontend/dist/"
cd "$REPO_DIR"

# ── STEP 7: Write PM2 ecosystem (with venv paths + dashboard) ──────────────
echo -e "\n${BOLD}── STEP 7: Writing PM2 ecosystem ──${NC}"
cat > "$REPO_DIR/ecosystem.config.js" << 'ECOSYSTEM'
'use strict';
const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [

    // 1. Gateway (Node.js / Express)
    {
      name:         'sentinal-gateway',
      script:       path.join(root, 'backend', 'server.js'),
      cwd:          path.join(root, 'backend'),
      instances:    1, exec_mode: 'fork', watch: false, autorestart: true,
      max_restarts: 10, restart_delay: 3000,
      env: { NODE_ENV: 'production' },
      out_file:   path.join(root, 'logs', 'gateway.out.log'),
      error_file: path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 2. Detection Engine (Python / FastAPI / uvicorn)
    {
      name:         'sentinal-detection',
      script:       path.join(root, 'services', 'detection-engine', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn app.main:app --host 0.0.0.0 --port 8002 --no-access-log',
      cwd:          path.join(root, 'services', 'detection-engine'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'detection.out.log'),
      error_file: path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 3. PCAP Processor (Python / FastAPI / uvicorn)
    {
      name:         'sentinal-pcap',
      script:       path.join(root, 'services', 'pcap-processor', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn main:app --host 0.0.0.0 --port 8003 --no-access-log',
      cwd:          path.join(root, 'services', 'pcap-processor'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'pcap.out.log'),
      error_file: path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 4. Nexus Agent (Python / FastAPI / uvicorn)
    {
      name:         'sentinal-nexus',
      script:       path.join(root, 'services', 'nexus-agent', '.venv', 'bin', 'python3'),
      args:         '-m uvicorn main:app --host 0.0.0.0 --port 8004 --no-access-log',
      cwd:          path.join(root, 'services', 'nexus-agent'),
      interpreter:  'none', instances: 1, exec_mode: 'fork', watch: false,
      autorestart: true, max_restarts: 10, restart_delay: 3000,
      env: { PYTHONUNBUFFERED: '1' },
      out_file:   path.join(root, 'logs', 'nexus.out.log'),
      error_file: path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

    // 5. React Dashboard (Vite build served via 'serve')
    {
      name:        'sentinal-dashboard',
      script:      'serve',
      args:        '-s frontend/dist -l 5173',
      cwd:         __dirname,
      interpreter: 'none',
      instances:   1, exec_mode: 'fork', watch: false, autorestart: true,
      env: { NODE_ENV: 'production' },
      out_file:   path.join(__dirname, 'logs', 'dashboard.out.log'),
      error_file: path.join(__dirname, 'logs', 'dashboard.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },

  ],
};
ECOSYSTEM
log "ecosystem.config.js written (5 services)"

# ── STEP 8: Start all services ─────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 8: Starting all services with PM2 ──${NC}"
mkdir -p "$REPO_DIR/logs"
pm2 delete all > /dev/null 2>&1 || true
cd "$REPO_DIR"
pm2 start ecosystem.config.js
log "All 5 services started"

# ── STEP 9: PM2 startup (survive reboots) ──────────────────────────────────
echo -e "\n${BOLD}── STEP 9: Configuring PM2 startup on reboot ──${NC}"
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || \
  systemctl enable pm2-root > /dev/null 2>&1 || true
pm2 save > /dev/null 2>&1
log "PM2 startup configured — services will auto-restart after reboot"

# ── STEP 10: Health checks ─────────────────────────────────────────────────
echo -e "\n${BOLD}── STEP 10: Running health checks (waiting 10s for startup) ──${NC}"
sleep 10

check_health() {
  local NAME=$1 URL=$2
  local STATUS
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$URL")
  if [ "$STATUS" = "200" ]; then
    log "$NAME → HTTP 200 ✓"
  else
    err "$NAME → HTTP $STATUS ✗  — run: pm2 logs $NAME"
  fi
}

check_health "sentinal-gateway"   "http://localhost:3000/health"
check_health "sentinal-detection" "http://localhost:8002/health"
check_health "sentinal-pcap"      "http://localhost:8003/health"
check_health "sentinal-nexus"     "http://localhost:8004/health"
check_health "sentinal-dashboard" "http://localhost:5173"

# ── Final output ───────────────────────────────────────────────────────────
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
warn " IMPORTANT: Add server IP to MongoDB Atlas!"
warn " Atlas → Network Access → Add IP Address → $PUBLIC_IP"
warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -e "\n${BOLD}${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║         SENTINAL DEPLOY COMPLETE ✓           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}        http://$PUBLIC_IP:5173"
echo -e "  ${BOLD}Gateway API:${NC}      http://$PUBLIC_IP:3000"
echo -e "  ${BOLD}Detection Engine:${NC} http://$PUBLIC_IP:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}   http://$PUBLIC_IP:8003"
echo -e "  ${BOLD}Nexus Agent:${NC}      http://$PUBLIC_IP:8004"
echo ""
echo -e "  ${BOLD}PM2 status:${NC}  pm2 list"
echo -e "  ${BOLD}View logs:${NC}   pm2 logs sentinal-gateway"
echo -e "  ${BOLD}Monitor:${NC}     pm2 monit"
echo -e "  ${BOLD}Restart all:${NC} pm2 restart all"
echo ""
