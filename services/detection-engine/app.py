"""
Detection Engine — SENTINAL microservice
Stage 4: Robustness — input validation, structured logging, edge-case handling.
"""

import time
import logging
from collections import defaultdict
from flask import Flask, request, jsonify

# ── Logging setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("detection-engine")

app = Flask(__name__)

# ── In-memory tracking windows ─────────────────────────────────────────────────
_login_tracker   = defaultdict(list)
_port_tracker    = defaultdict(list)
_request_tracker = defaultdict(list)

# ── Thresholds ─────────────────────────────────────────────────────────────────
BRUTE_FORCE_THRESHOLD = 5
PORT_SCAN_THRESHOLD   = 10
DDOS_THRESHOLD        = 100
TIME_WINDOW_SECONDS   = 60

VALID_EVENT_TYPES = {
    "login_attempt", "auth_failure", "failed_login",
    "port_probe", "http_request", "tcp_connect", "udp_flood"
}


def _prune(event_list):
    now = time.time()
    return [t for t in event_list if now - t < TIME_WINDOW_SECONDS]


def _detect_brute_force(src_ip, event_type):
    if event_type not in ("login_attempt", "auth_failure", "failed_login"):
        return False
    _login_tracker[src_ip] = _prune(_login_tracker[src_ip])
    _login_tracker[src_ip].append(time.time())
    return len(_login_tracker[src_ip]) >= BRUTE_FORCE_THRESHOLD


def _detect_port_scan(src_ip, dst_port):
    if dst_port is None:
        return False
    _port_tracker[src_ip] = _prune(_port_tracker[src_ip])
    _port_tracker[src_ip].append(time.time())
    return len(_port_tracker[src_ip]) >= PORT_SCAN_THRESHOLD


def _detect_ddos(src_ip):
    _request_tracker[src_ip] = _prune(_request_tracker[src_ip])
    _request_tracker[src_ip].append(time.time())
    return len(_request_tracker[src_ip]) >= DDOS_THRESHOLD


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "detection-engine"})


@app.route("/detect", methods=["POST"])
def detect():
    # ── Parse JSON ─────────────────────────────────────────────────────────────
    try:
        data = request.get_json(force=True, silent=True)
    except Exception:
        data = None

    if not data or not isinstance(data, dict):
        logger.warning("[DETECT] Rejected: missing or malformed JSON body")
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    # ── Extract and validate fields ────────────────────────────────────────────
    src_ip     = str(data.get("src_ip", "")).strip()
    event_type = str(data.get("event_type", "")).strip().lower()
    dst_port   = data.get("dst_port")

    if not src_ip:
        logger.warning("[DETECT] Rejected: src_ip is required")
        return jsonify({"error": "src_ip is required"}), 400

    if event_type and event_type not in VALID_EVENT_TYPES:
        logger.warning(f"[DETECT] Unknown event_type '{event_type}' from {src_ip}")
        # Don't reject — log and continue with detection

    if dst_port is not None:
        try:
            dst_port = int(dst_port)
            if not (0 <= dst_port <= 65535):
                raise ValueError
        except (ValueError, TypeError):
            logger.warning(f"[DETECT] Invalid dst_port '{dst_port}' from {src_ip} — ignoring")
            dst_port = None

    # ── Run detection rules ────────────────────────────────────────────────────
    verdict     = "clean"
    attack_type = None
    confidence  = 0.0

    if _detect_brute_force(src_ip, event_type):
        verdict, attack_type, confidence = "attack", "brute_force", 0.90
    elif _detect_port_scan(src_ip, dst_port):
        verdict, attack_type, confidence = "attack", "port_scan", 0.85
    elif _detect_ddos(src_ip):
        verdict, attack_type, confidence = "attack", "ddos", 0.95

    if verdict == "attack":
        logger.warning(f"[DETECT] ATTACK detected | type={attack_type} | ip={src_ip} | confidence={confidence}")
    else:
        logger.info(f"[DETECT] clean | ip={src_ip} | event={event_type}")

    return jsonify({
        "verdict":     verdict,
        "attack_type": attack_type,
        "confidence":  confidence,
        "src_ip":      src_ip
    }), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed"}), 405


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"[SERVER] Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    logger.info("[STARTUP] Detection Engine starting on port 5001")
    app.run(host="0.0.0.0", port=5001, debug=False)
