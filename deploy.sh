#!/usr/bin/env bash
# =============================================================================
# SENTINAL — deploy.sh  v6.0
# Production deployment for archijain23/SENTINAL
# Cloud-agnostic: Vultr / AWS EC2 / DigitalOcean / Any Ubuntu 22.04 VM
# =============================================================================
# Usage (fresh server):
#   curl -s https://raw.githubusercontent.com/archijain23/SENTINAL/main/deploy.sh | bash
# Usage (re-deploy):
#   bash deploy.sh
#
# FIXES IN v6.0 vs v5.0:
#   [FIX-1] serve resolved to absolute path at ecosystem generation time
#           → prevents "serve not found" when PM2 runs under minimal PATH
#   [FIX-2] PM2 reload falls back to full delete+start when reload fails
#           → fixes "[PM2][ERROR] Process N not found" on re-deploy
#   [FIX-3] Detection-engine uses full requirements from "requirements copy.txt"
#           → auto-renames the file if requirements.txt is the stub 7-line version
#   [FIX-4] Pre-flight env check before starting services
#           → MONGO_URI validated + synced to backend/.env before any pm2 start
#   [FIX-5] PYTHONPATH set explicitly in ecosystem for detection-engine
#           → ensures uvicorn can resolve app.main:app as a package
#   [FIX-6] PM2 pidusage errors silenced by removing errored processes pre-reload
#           → pm2 delete orphaned errored processes before reload
#   [FIX-7] Health check wait extended + per-service log tail on failure
#           → shows actual crash reason without needing manual pm2 logs
#   [FIX-8] detection-engine app/__init__.py created if missing
#           → prevents "ModuleNotFoundError: No module named 'app'" at uvicorn start
#   [FIX-9] All Python services tested for clean import before PM2 start
#           → catches import errors at deploy time, not at health-check time
#
#   NEW in v6.0:
#   [FIX-10] serve CLI flag fixed: --listen → -l (deprecated in serve v14+)
#            → prevents dashboard binding to wrong port or failing to start
#   [FIX-11] Swap file created if available RAM < 1024MB before Vite build
#            → prevents OOM-kill during npm run build on small instances
#   [FIX-12] pcap pre-flight import extended to include scapy + pyshark
#            → catches missing tshark/scapy before PM2 start, not after
#   [FIX-13] PATH set explicitly in pcap-processor ecosystem env block
#            → ensures tshark is findable by pyshark in PM2's sanitized PATH
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ── Colour palette ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── Logging ────────────────────────────────────────────────────────────────────
DEPLOY_LOG="/var/log/sentinal-deploy.log"
DEPLOY_TS=$(date '+%Y-%m-%d %H:%M:%S')

_log_file() { echo "[$DEPLOY_TS] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }

log()    { echo -e "${GREEN}[✓]${NC} $1";        _log_file "[OK]    $1"; }
info()   { echo -e "${BLUE}[→]${NC}  $1";         _log_file "[INFO]  $1"; }
warn()   { echo -e "${YELLOW}[!]${NC}  $1";       _log_file "[WARN]  $1"; }
err()    { echo -e "${RED}[✗]${NC}  $1";          _log_file "[ERR]   $1"; }
detail() { echo -e "     ${YELLOW}↳ $1${NC}";     _log_file "[DETAIL] $1"; }
section() {
  echo ""
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  _log_file "=== $1 ==="
}

# ── ERR trap ──────────────────────────────────────────────────────────────────
trap 'err "Deploy FAILED on line $LINENO — check $DEPLOY_LOG"; exit 1' ERR

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║          SENTINAL — Production Deploy  v6.0             ║${NC}"
echo -e "${BOLD}${GREEN}║      Vultr · AWS EC2 · DigitalOcean · Ubuntu 22.04      ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
info "Started: $(date '+%Y-%m-%d %H:%M:%S')"
sudo touch "$DEPLOY_LOG" 2>/dev/null && sudo chmod 666 "$DEPLOY_LOG" 2>/dev/null || true
info "Deploy log: $DEPLOY_LOG"

# =============================================================================
# CONFIG
# =============================================================================
GITHUB_REPO="https://github.com/archijain23/SENTINAL.git"
REPO_DIR="${REPO_DIR:-$HOME/SENTINAL}"
FRONTEND_DIR="frontend"
LOGS_DIR="$REPO_DIR/logs"
MONGO_IS_PLACEHOLDER=false

# =============================================================================
# STEP 0 — DETECT PUBLIC IP
# =============================================================================
section "STEP 0: Detecting public IP"

PUBLIC_IP=""
for provider in \
  "http://checkip.amazonaws.com" \
  "https://api.ipify.org" \
  "https://ifconfig.me" \
  "https://icanhazip.com" \
  "https://ipecho.net/plain"; do
  PUBLIC_IP=$(curl -s --max-time 5 "$provider" 2>/dev/null | tr -d '[:space:]') || continue
  [[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && break
  PUBLIC_IP=""
done

if [[ -z "$PUBLIC_IP" ]]; then
  warn "Could not auto-detect public IP."
  read -rp "  ▸ Enter this server's public IP address: " PUBLIC_IP
fi
log "Public IP: $PUBLIC_IP"

# =============================================================================
# STEP 1 — SYSTEM DEPENDENCIES
# =============================================================================
section "STEP 1: Installing system dependencies"

export DEBIAN_FRONTEND=noninteractive

info "Updating apt..."
sudo apt-get update -qq

# ── Node.js 20 ─────────────────────────────────────────────────────────────────
NODE_MAJOR=20
CURRENT_NODE_MAJOR=0
command -v node &>/dev/null && \
  CURRENT_NODE_MAJOR=$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)

if [[ "$CURRENT_NODE_MAJOR" -lt "$NODE_MAJOR" ]]; then
  info "Installing Node.js ${NODE_MAJOR}..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs >/dev/null 2>&1
fi
log "Node.js $(node --version)"

# ── Python + build tools + tshark ─────────────────────────────────────────────
info "Installing Python3 + build tools + tshark..."
echo "wireshark-common wireshark-common/install-setuid boolean false" | \
  sudo debconf-set-selections
sudo apt-get install -y \
  python3 python3-venv python3-pip python3-dev \
  build-essential libssl-dev libffi-dev libpcap-dev \
  tshark curl git jq >/dev/null 2>&1
log "Python $(python3 --version) | tshark installed"

# ── PM2 ───────────────────────────────────────────────────────────────────────
if ! command -v pm2 &>/dev/null; then
  info "Installing PM2..."
  sudo npm install -g pm2 >/dev/null 2>&1
else
  info "Upgrading PM2..."
  sudo npm install -g pm2 >/dev/null 2>&1 || true
fi
log "PM2 $(pm2 --version)"

# ── serve — FIX-1: resolve absolute path immediately ──────────────────────────
if ! command -v serve &>/dev/null; then
  info "Installing serve..."
  sudo npm install -g serve >/dev/null 2>&1
fi
SERVE_BIN=$(command -v serve)
log "serve → $SERVE_BIN"

# =============================================================================
# STEP 2 — REPOSITORY
# =============================================================================
section "STEP 2: Repository — clone or pull"

if [[ -d "$REPO_DIR/.git" ]]; then
  info "Repo exists — pulling latest..."
  cd "$REPO_DIR"
  git stash --include-untracked >/dev/null 2>&1 || true
  git fetch origin main >/dev/null 2>&1
  git reset --hard origin/main >/dev/null 2>&1
  log "Updated → $(git rev-parse --short HEAD)"
else
  info "Cloning repository..."
  git clone "$GITHUB_REPO" "$REPO_DIR"
  cd "$REPO_DIR"
  log "Cloned → $(git rev-parse --short HEAD)"
fi
cd "$REPO_DIR"

# =============================================================================
# STEP 3 — PYTHON VIRTUAL ENVIRONMENTS
# =============================================================================
section "STEP 3: Python virtual environments"

# FIX-8: Ensure detection-engine app/__init__.py exists
# (also committed to git in v6.0 so git reset does not remove it)
INIT_FILE="$REPO_DIR/services/detection-engine/app/__init__.py"
if [[ ! -f "$INIT_FILE" ]]; then
  touch "$INIT_FILE"
  info "Created app/__init__.py for detection-engine (FIX-8)"
fi

# FIX-3: Auto-fix detection-engine requirements.txt if it is the stub version
# In v6.0 the real requirements.txt is committed, so this is a safety net only.
DETECT_REQS="$REPO_DIR/services/detection-engine/requirements.txt"
DETECT_REQS_FULL="$REPO_DIR/services/detection-engine/requirements copy.txt"
if [[ -f "$DETECT_REQS" ]]; then
  REQ_LINE_COUNT=$(wc -l < "$DETECT_REQS")
  if [[ "$REQ_LINE_COUNT" -lt 15 ]] && [[ -f "$DETECT_REQS_FULL" ]]; then
    info "Detection requirements.txt is stub (${REQ_LINE_COUNT} lines) — upgrading to full version (FIX-3)"
    cp "$DETECT_REQS_FULL" "$DETECT_REQS"
    log "requirements.txt replaced with full ML requirements"
  fi
elif [[ -f "$DETECT_REQS_FULL" ]]; then
  cp "$DETECT_REQS_FULL" "$DETECT_REQS"
  log "Copied 'requirements copy.txt' → requirements.txt"
fi

setup_venv() {
  local svc_dir=$1 svc_label=$2
  local full_path="$REPO_DIR/$svc_dir"

  if [[ ! -d "$full_path" ]]; then
    warn "Directory missing: $full_path — skipping $svc_label"
    return 0
  fi

  info "Setting up venv: $svc_label"
  cd "$full_path"

  if [[ ! -f ".venv/bin/activate" ]]; then
    python3 -m venv .venv
  fi

  .venv/bin/pip install --upgrade pip -q
  if [[ -f "requirements.txt" ]]; then
    info "  Installing packages for $svc_label..."
    .venv/bin/pip install -r requirements.txt -q
  else
    warn "  No requirements.txt found for $svc_label"
  fi

  log "$svc_label venv ready"
  cd "$REPO_DIR"
}

setup_venv "services/detection-engine" "Detection Engine"
setup_venv "services/pcap-processor"   "PCAP Processor"
setup_venv "services/nexus-agent"      "Nexus Agent"

# ── FIX-9 / FIX-12: Pre-flight Python import test ─────────────────────────────
section "STEP 3b: Python import validation"

test_python_import() {
  local svc_dir=$1 svc_label=$2 import_test=$3
  local full_path="$REPO_DIR/$svc_dir"
  [[ ! -d "$full_path" ]] && return 0

  info "Testing imports: $svc_label"
  local result
  result=$(cd "$full_path" && .venv/bin/python3 -c "$import_test" 2>&1) || {
    err "$svc_label import FAILED — service will crash on startup:"
    detail "$result"
    detail "Fix: cd $full_path && .venv/bin/pip install -r requirements.txt"
    return 1
  }
  log "$svc_label imports OK"
}

# Detection Engine: includes ML packages (FIX-9)
test_python_import \
  "services/detection-engine" \
  "Detection Engine" \
  "import fastapi, uvicorn, sklearn, xgboost, joblib; print('ok')" || \
  warn "Detection Engine import failed — check requirements.txt (FIX-3)"

# PCAP Processor: includes scapy + pyshark (FIX-12)
# Note: pyshark checks for tshark at import time; failure here means tshark
# is not installed or not in PATH — fix: sudo apt-get install -y tshark
test_python_import \
  "services/pcap-processor" \
  "PCAP Processor" \
  "import fastapi, uvicorn, scapy, pyshark; print('ok')" || \
  warn "PCAP Processor import failed — ensure tshark is installed (apt install tshark)"

# Nexus Agent
test_python_import \
  "services/nexus-agent" \
  "Nexus Agent" \
  "import fastapi, uvicorn; print('ok')" || \
  warn "Nexus Agent import failed — check requirements.txt"

# =============================================================================
# STEP 4 — NODE.JS DEPENDENCIES
# =============================================================================
section "STEP 4: Node.js dependencies"

if [[ -f "$REPO_DIR/backend/package.json" ]]; then
  cd "$REPO_DIR/backend"
  npm install --omit=dev --silent
  log "Backend node_modules installed"
  cd "$REPO_DIR"
fi

if [[ -f "$REPO_DIR/$FRONTEND_DIR/package.json" ]]; then
  cd "$REPO_DIR/$FRONTEND_DIR"
  npm install --silent
  log "Frontend node_modules installed"
  cd "$REPO_DIR"
fi

# =============================================================================
# STEP 5 — ENVIRONMENT CONFIGURATION
# =============================================================================
section "STEP 5: Environment configuration"

# upsert_env file key value [force=false]
#   force=false → preserve any existing non-placeholder value
#   force=true  → always overwrite
upsert_env() {
  local file=$1 key=$2 value=$3 force=${4:-false}
  [[ ! -f "$file" ]] && touch "$file"

  if grep -q "^${key}=" "$file" 2>/dev/null; then
    local existing
    existing=$(grep "^${key}=" "$file" | head -1 | cut -d'=' -f2-)
    if [[ "$force" == "false" ]]; then
      if [[ -n "$existing" ]] && \
         [[ "$existing" != *"your_"* ]] && \
         [[ "$existing" != *"change_me"* ]] && \
         [[ "$existing" != *"username:password"* ]] && \
         [[ "$existing" != *"<"* ]] && \
         [[ "$existing" != "CHANGEME"* ]]; then
        return 0
      fi
    fi
    sed -i "s|^${key}=.*|${key}=${value}|g" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

# Create .env files from examples if missing
[[ ! -f "$REPO_DIR/.env" ]] && {
  if [[ -f "$REPO_DIR/.env.example" ]]; then
    cp "$REPO_DIR/.env.example" "$REPO_DIR/.env"
    info "Created .env from .env.example"
  else
    touch "$REPO_DIR/.env"
    info "Created blank .env"
  fi
}
[[ ! -f "$REPO_DIR/backend/.env" ]] && {
  if [[ -f "$REPO_DIR/backend/.env.example" ]]; then
    cp "$REPO_DIR/backend/.env.example" "$REPO_DIR/backend/.env"
    info "Created backend/.env from .env.example"
  else
    touch "$REPO_DIR/backend/.env"
    info "Created blank backend/.env"
  fi
}

# Generate secrets — only used if no real value exists yet
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
API_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")

# Infrastructure vars — always force (not sensitive)
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

# Secrets — only write if placeholder/missing
upsert_env "$REPO_DIR/.env" "JWT_SECRET"  "$JWT_SECRET"  "false"
upsert_env "$REPO_DIR/.env" "API_SECRET"  "$API_SECRET"  "false"

# Sync live secrets to backend/.env
LIVE_JWT=$(grep "^JWT_SECRET=" "$REPO_DIR/.env" | head -1 | cut -d'=' -f2-)
LIVE_API=$(grep "^API_SECRET=" "$REPO_DIR/.env" | head -1 | cut -d'=' -f2-)
upsert_env "$REPO_DIR/backend/.env" "JWT_SECRET" "$LIVE_JWT"   "true"
upsert_env "$REPO_DIR/backend/.env" "API_SECRET" "$LIVE_API"   "true"
upsert_env "$REPO_DIR/backend/.env" "NODE_ENV"   "production"  "true"
upsert_env "$REPO_DIR/backend/.env" "PORT"       "3000"        "true"

# ── FIX-4: MONGO_URI — validate and sync BEFORE any service starts ─────────────
CURRENT_MONGO=$(grep "^MONGO_URI=" "$REPO_DIR/.env" 2>/dev/null | head -1 | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_MONGO" ]] || \
   [[ "$CURRENT_MONGO" == *"username:password"* ]] || \
   [[ "$CURRENT_MONGO" == *"change_me"* ]] || \
   [[ "$CURRENT_MONGO" == *"<"* ]] || \
   [[ "$CURRENT_MONGO" == "CHANGEME"* ]]; then
  MONGO_IS_PLACEHOLDER=true
fi

if [[ "$MONGO_IS_PLACEHOLDER" == "true" ]]; then
  echo ""
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "  MONGO_URI is NOT configured."
  warn "  The Gateway (port 3000) will EXIT immediately without it."
  warn "  Get it from: MongoDB Atlas → Connect → Drivers"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  read -rp "  ▸ MongoDB Atlas URI (Enter to skip): " MONGO_URI_INPUT
  if [[ -n "$MONGO_URI_INPUT" ]]; then
    upsert_env "$REPO_DIR/.env"         "MONGO_URI" "$MONGO_URI_INPUT" "true"
    upsert_env "$REPO_DIR/backend/.env" "MONGO_URI" "$MONGO_URI_INPUT" "true"
    MONGO_IS_PLACEHOLDER=false
    log "MONGO_URI saved to .env and backend/.env"
  else
    warn "MONGO_URI skipped — sentinal-gateway WILL FAIL to start"
    warn "Fix: nano $REPO_DIR/.env → pm2 restart sentinal-gateway"
  fi
else
  upsert_env "$REPO_DIR/backend/.env" "MONGO_URI" "$CURRENT_MONGO" "true"
  log "MONGO_URI configured — synced to backend/.env"
fi

# Optional API key warnings
CURRENT_GEMINI=$(grep "^GEMINI_API_KEY=" "$REPO_DIR/.env" 2>/dev/null | head -1 | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_GEMINI" ]] || [[ "$CURRENT_GEMINI" == *"your_"* ]]; then
  warn "GEMINI_API_KEY not set — Nexus AI features will be disabled"
fi

CURRENT_ABUSE=$(grep "^ABUSEIPDB_API_KEY=" "$REPO_DIR/.env" 2>/dev/null | head -1 | cut -d'=' -f2- || true)
if [[ -z "$CURRENT_ABUSE" ]] || [[ "$CURRENT_ABUSE" == *"your_"* ]]; then
  warn "ABUSEIPDB_API_KEY not set — IP reputation scoring disabled"
fi

log ".env configuration complete"

# =============================================================================
# PRE-BUILD: Ensure sufficient RAM for Vite build (FIX-11)
# Heavy frontend (Three.js + GSAP + Chart.js) can OOM-kill npm run build
# on Vultr/DO instances with ≤1GB RAM. Create a 2GB swapfile if needed.
# =============================================================================
section "PRE-BUILD: RAM check for Vite build"

AVAIL_RAM_MB=$(free -m | awk '/^Mem:/{print $7}')
info "Available RAM: ${AVAIL_RAM_MB}MB"

if [[ "$AVAIL_RAM_MB" -lt 1024 ]]; then
  if swapon --show | grep -q '/swapfile' 2>/dev/null; then
    info "Swapfile already active — skipping creation"
  else
    info "Low RAM detected (${AVAIL_RAM_MB}MB) — creating 2GB swapfile to prevent OOM during build (FIX-11)..."
    if sudo fallocate -l 2G /swapfile 2>/dev/null; then
      : # fallocate succeeded
    elif sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none; then
      : # dd fallback succeeded
    else
      warn "Could not create swapfile — build may OOM on low-RAM instances"
    fi
    if [[ -f /swapfile ]]; then
      sudo chmod 600 /swapfile
      sudo mkswap /swapfile >/dev/null 2>&1
      sudo swapon /swapfile
      log "Swapfile (2GB) active — build memory protected"
    fi
  fi
else
  log "RAM sufficient (${AVAIL_RAM_MB}MB available) — no swapfile needed"
fi

# =============================================================================
# STEP 6 — BUILD REACT FRONTEND
# =============================================================================
section "STEP 6: Building React frontend (Vite)"

FRONTEND_PATH="$REPO_DIR/$FRONTEND_DIR"
FRONTEND_DIST="$FRONTEND_PATH/dist"

cat > "$FRONTEND_PATH/.env.production" <<EOF
VITE_API_URL=http://${PUBLIC_IP}:3000
VITE_SOCKET_URL=http://${PUBLIC_IP}:3000
VITE_WS_URL=ws://${PUBLIC_IP}:3000
EOF
log "frontend/.env.production → API at http://${PUBLIC_IP}:3000"

cd "$FRONTEND_PATH"
info "Running: npm run build"
npm run build 2>&1 | tee -a "$DEPLOY_LOG"

[[ ! -f "$FRONTEND_DIST/index.html" ]] && {
  err "Vite build failed — $FRONTEND_DIST/index.html not found!"
  err "If this was an out-of-memory error, check: dmesg | grep -i 'oom\|killed'"
  err "Re-run deploy.sh — the swapfile will be created on the second attempt."
  exit 1
}
log "Frontend build verified → $FRONTEND_DIST"
cd "$REPO_DIR"

# =============================================================================
# STEP 7 — LOGS DIRECTORY
# =============================================================================
mkdir -p "$LOGS_DIR"
log "Logs directory: $LOGS_DIR"

# =============================================================================
# STEP 8 — GENERATE PM2 ECOSYSTEM
# =============================================================================
section "STEP 8: Generating PM2 ecosystem.config.js"

# SERVE_BIN and FRONTEND_DIST are already resolved above as absolute paths.
# FIX-10: Use -l (--port) instead of --listen which was deprecated in serve v14+.
#         Use -s instead of --single for SPA mode (works across all versions).
# This heredoc is unquoted so bash expands the variables at write time.

cat > "$REPO_DIR/ecosystem.config.js" <<JSEOF
'use strict';
// Auto-generated by deploy.sh v6.0 on $(date '+%Y-%m-%d %H:%M:%S')
// DO NOT EDIT MANUALLY — re-run deploy.sh to regenerate
const path = require('path');
const root  = __dirname;

module.exports = {
  apps: [
    // ── Gateway (Node.js / Express) ───────────────────────────────
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
      env: {
        NODE_ENV:     'production',
        PORT:         '3000',
        NODE_OPTIONS: '--max-old-space-size=512',
      },
      env_file:        path.join(root, '.env'),
      out_file:        path.join(root, 'logs', 'gateway.out.log'),
      error_file:      path.join(root, 'logs', 'gateway.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── Detection Engine (Python / FastAPI) ───────────────────────
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
      env: {
        PYTHONUNBUFFERED:        '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONPATH:              path.join(root, 'services', 'detection-engine'),
      },
      env_file:        path.join(root, '.env'),
      out_file:        path.join(root, 'logs', 'detection.out.log'),
      error_file:      path.join(root, 'logs', 'detection.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── PCAP Processor (Python / FastAPI) ─────────────────────────
    // FIX-13: PATH set explicitly so tshark is found by pyshark
    //         under PM2's sanitized environment.
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
      env: {
        PYTHONUNBUFFERED:        '1',
        PYTHONDONTWRITEBYTECODE: '1',
        PATH:                    '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      },
      env_file:        path.join(root, '.env'),
      out_file:        path.join(root, 'logs', 'pcap.out.log'),
      error_file:      path.join(root, 'logs', 'pcap.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── Nexus Agent (Python / FastAPI) ────────────────────────────
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
      env: {
        PYTHONUNBUFFERED:        '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
      env_file:        path.join(root, '.env'),
      out_file:        path.join(root, 'logs', 'nexus.out.log'),
      error_file:      path.join(root, 'logs', 'nexus.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },

    // ── React Dashboard (Vite build via serve) ────────────────────
    // FIX-1:  Absolute path to serve binary resolved at deploy time
    // FIX-10: -l replaces deprecated --listen (serve v14+)
    //         -s replaces --single for SPA fallback routing
    {
      name:          'sentinal-dashboard',
      script:        '${SERVE_BIN}',
      args:          '-s ${FRONTEND_DIST} -l 5173 --no-clipboard',
      cwd:           root,
      interpreter:   'none',
      instances:     1,
      exec_mode:     'fork',
      watch:         false,
      autorestart:   true,
      max_restarts:  15,
      min_uptime:    '5s',
      restart_delay: 3000,
      kill_timeout:  5000,
      env: { NODE_ENV: 'production' },
      out_file:        path.join(root, 'logs', 'dashboard.out.log'),
      error_file:      path.join(root, 'logs', 'dashboard.err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs:      false,
    },
  ],
};
JSEOF
log "ecosystem.config.js generated (serve → $SERVE_BIN)"

# =============================================================================
# STEP 9 — START / RELOAD SERVICES
# =============================================================================
section "STEP 9: Starting services with PM2"
cd "$REPO_DIR"

# FIX-6: Remove errored/stopped processes before reload to clear stale PIDs
ERRORED_PROCS=$(pm2 list 2>/dev/null | grep -E "errored|stopped" | awk '{print $4}' | grep -v "^$" || true)
if [[ -n "$ERRORED_PROCS" ]]; then
  info "Removing stale errored processes from PM2 table (FIX-6)..."
  while IFS= read -r proc_name; do
    [[ -n "$proc_name" ]] && pm2 delete "$proc_name" >/dev/null 2>&1 || true
  done <<< "$ERRORED_PROCS"
  log "Stale processes removed"
fi

# FIX-2: Smart reload with automatic fallback to delete+start
PM2_HAS_GATEWAY=false
pm2 list 2>/dev/null | grep -q "sentinal-gateway" && PM2_HAS_GATEWAY=true

if [[ "$PM2_HAS_GATEWAY" == "true" ]]; then
  info "Services detected — zero-downtime reload..."
  RELOAD_OK=true
  pm2 reload ecosystem.config.js --update-env 2>&1 | tee -a "$DEPLOY_LOG" || RELOAD_OK=false

  if [[ "$RELOAD_OK" == "true" ]]; then
    sleep 4
    POST_RELOAD_ERRORED=$(pm2 list 2>/dev/null | grep "sentinal" | grep "errored" | awk '{print $4}' | grep -v "^$" || true)
    if [[ -n "$POST_RELOAD_ERRORED" ]]; then
      warn "Services errored after reload — falling back to fresh start (FIX-2)..."
      pm2 delete all >/dev/null 2>&1 || true
      sleep 2
      pm2 start ecosystem.config.js
      log "Services started fresh after reload failure"
    else
      log "All services reloaded cleanly (zero downtime)"
    fi
  else
    warn "pm2 reload returned error — falling back to fresh start (FIX-2)..."
    pm2 delete all >/dev/null 2>&1 || true
    sleep 2
    pm2 start ecosystem.config.js
    log "Services started fresh"
  fi
else
  info "First-time deploy — starting all services..."
  pm2 start ecosystem.config.js
  log "All 5 services started"
fi

# =============================================================================
# STEP 10 — PM2 STARTUP PERSISTENCE
# =============================================================================
section "STEP 10: PM2 startup on reboot"

CURRENT_USER=$(whoami)
PM2_STARTUP_OUTPUT=$(pm2 startup systemd -u "$CURRENT_USER" --hp "$HOME" 2>/dev/null || true)
PM2_STARTUP_CMD=$(echo "$PM2_STARTUP_OUTPUT" | grep "sudo env" | head -1 || true)

if [[ -n "$PM2_STARTUP_CMD" ]]; then
  eval "$PM2_STARTUP_CMD" >/dev/null 2>&1 && log "PM2 systemd startup unit installed"
else
  sudo systemctl enable "pm2-${CURRENT_USER}" >/dev/null 2>&1 || true
  log "PM2 startup unit enabled"
fi

pm2 save --force >/dev/null 2>&1
log "PM2 process list saved — persists across reboots"

# =============================================================================
# STEP 11 — UFW FIREWALL
# =============================================================================
section "STEP 11: UFW firewall"

if command -v ufw &>/dev/null; then
  sudo ufw allow 22/tcp    comment "SSH"                  >/dev/null 2>&1 || true
  sudo ufw allow 3000/tcp  comment "SENTINAL Gateway"     >/dev/null 2>&1 || true
  sudo ufw allow 5173/tcp  comment "SENTINAL Dashboard"   >/dev/null 2>&1 || true
  sudo ufw allow 8002/tcp  comment "SENTINAL Detection"   >/dev/null 2>&1 || true
  sudo ufw allow 8003/tcp  comment "SENTINAL PCAP"        >/dev/null 2>&1 || true
  sudo ufw allow 8004/tcp  comment "SENTINAL Nexus"       >/dev/null 2>&1 || true
  UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1 || true)
  if [[ "$UFW_STATUS" != *"active"* ]]; then
    echo "y" | sudo ufw enable >/dev/null 2>&1 || true
  fi
  log "UFW: ports 22, 3000, 5173, 8002, 8003, 8004 open"
else
  warn "UFW not installed — run: sudo apt install ufw"
fi

# =============================================================================
# STEP 12 — HEALTH CHECKS
# =============================================================================
section "STEP 12: Health checks"

HEALTH_WAIT=20
info "Waiting ${HEALTH_WAIT}s for services to initialise..."
sleep "$HEALTH_WAIT"

HEALTH_PASS=0
HEALTH_FAIL=0
FAILED_SERVICES=()

# FIX-7: Print last error log lines automatically on health check failure
check_health() {
  local name=$1 url=$2 err_log=$3
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    --max-time 10 --retry 3 --retry-delay 4 "$url" 2>/dev/null || echo "000")

  if [[ "$code" == "200" ]]; then
    log "  ✅ $name  →  $url  →  HTTP $code"
    (( HEALTH_PASS++ )) || true
  else
    err "  ❌ $name  →  $url  →  HTTP $code"
    FAILED_SERVICES+=("$name")
    (( HEALTH_FAIL++ )) || true
    if [[ -f "$err_log" ]] && [[ -s "$err_log" ]]; then
      echo ""
      echo -e "     ${YELLOW}Last error log:${NC}"
      tail -n 12 "$err_log" | sed 's/^/     │ /'
      echo ""
    else
      warn "  No error log yet — run: pm2 logs $name --lines 50"
    fi
  fi
}

check_health "sentinal-gateway  " "http://localhost:3000/health" "$LOGS_DIR/gateway.err.log"
check_health "sentinal-detection" "http://localhost:8002/health" "$LOGS_DIR/detection.err.log"
check_health "sentinal-pcap     " "http://localhost:8003/health" "$LOGS_DIR/pcap.err.log"
check_health "sentinal-nexus    " "http://localhost:8004/health" "$LOGS_DIR/nexus.err.log"
check_health "sentinal-dashboard" "http://localhost:5173"        "$LOGS_DIR/dashboard.err.log"

# =============================================================================
# STEP 13 — PM2 LOG ROTATION
# =============================================================================
section "STEP 13: PM2 log rotation"

pm2 list 2>/dev/null | grep -q "pm2-logrotate" || {
  pm2 install pm2-logrotate >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:max_size  10M  >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:retain    7    >/dev/null 2>&1 || true
  pm2 set pm2-logrotate:compress  true >/dev/null 2>&1 || true
  log "pm2-logrotate: 10MB, 7 days, gzip"
}

# =============================================================================
# DONE
# =============================================================================
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║            SENTINAL DEPLOYMENT COMPLETE  v6.0           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Frontend Dashboard:${NC}   http://${PUBLIC_IP}:5173"
echo -e "  ${BOLD}Gateway API:${NC}          http://${PUBLIC_IP}:3000"
echo -e "  ${BOLD}Detection Engine:${NC}     http://${PUBLIC_IP}:8002"
echo -e "  ${BOLD}PCAP Processor:${NC}       http://${PUBLIC_IP}:8003"
echo -e "  ${BOLD}Nexus Agent:${NC}          http://${PUBLIC_IP}:8004"
echo ""
echo -e "  ${BOLD}Commands:${NC}"
echo -e "    pm2 list                     — process table + status"
echo -e "    pm2 monit                    — live CPU / RAM"
echo -e "    pm2 logs sentinal-gateway    — gateway logs"
echo -e "    pm2 logs sentinal-detection  — detection logs"
echo -e "    tail -f $DEPLOY_LOG"
echo ""

if [[ "$MONGO_IS_PLACEHOLDER" == "true" ]]; then
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "  ACTION REQUIRED — Gateway will not work until you:"
  warn "  1. Set MONGO_URI in $REPO_DIR/.env"
  warn "  2. Add $PUBLIC_IP to MongoDB Atlas → Network Access"
  warn "  3. Run: pm2 restart sentinal-gateway"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  warn "Reminder: ensure $PUBLIC_IP is whitelisted in MongoDB Atlas Network Access"
fi
echo ""

if [[ $HEALTH_FAIL -gt 0 ]]; then
  echo -e "${RED}  ⚠  ${HEALTH_FAIL} service(s) failed health checks:${NC}"
  for svc in "${FAILED_SERVICES[@]}"; do
    echo -e "     ${RED}✗${NC}  $svc"
  done
  echo ""
  echo -e "  Debug: ${BOLD}pm2 logs <service-name> --lines 50${NC}"
else
  echo -e "${GREEN}  ✅  All ${HEALTH_PASS}/5 services healthy — SENTINAL is live!${NC}"
fi
echo ""
