"""
Response Engine — SENTINAL microservice
Stage 2 + 3: /action endpoint with real action execution logic.
"""

import os
import logging
import requests
from datetime import datetime, timezone
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("response-engine")

app = Flask(__name__)

GATEWAY_URL  = os.getenv("GATEWAY_URL", "http://localhost:3000")

# In-memory blocked IP set (persisted to Gateway/MongoDB in Stage 4)
_blocked_ips = set()

VALID_ACTIONS = {"block_ip", "unblock_ip", "create_alert", "notify"}


def _block_ip(target_ip):
    if not target_ip:
        return {"success": False, "reason": "target IP is required"}
    _blocked_ips.add(target_ip)
    logger.warning(f"[ACTION] Blocked IP: {target_ip}")
    # Notify gateway blocklist
    try:
        requests.post(
            f"{GATEWAY_URL}/api/blocklist",
            json={"ip": target_ip, "reason": "auto-blocked by response engine"},
            timeout=3
        )
    except Exception as e:
        logger.warning(f"[ACTION] Gateway notify failed: {e}")
    return {"success": True, "ip": target_ip, "action": "block_ip"}


def _unblock_ip(target_ip):
    if not target_ip:
        return {"success": False, "reason": "target IP is required"}
    _blocked_ips.discard(target_ip)
    logger.info(f"[ACTION] Unblocked IP: {target_ip}")
    return {"success": True, "ip": target_ip, "action": "unblock_ip"}


def _create_alert(data):
    message  = data.get("message", "Security alert triggered")
    severity = data.get("severity", "medium")
    try:
        requests.post(
            f"{GATEWAY_URL}/api/alerts",
            json={"message": message, "severity": severity, "source": "response-engine"},
            timeout=3
        )
        logger.info(f"[ACTION] Alert created | severity={severity}")
    except Exception as e:
        logger.warning(f"[ACTION] Alert notify failed: {e}")
    return {"success": True, "action": "create_alert", "message": message, "severity": severity}


@app.route("/health")
def health():
    return jsonify({
        "status":       "ok",
        "service":      "response-engine",
        "blocked_ips":  len(_blocked_ips)
    })


@app.route("/action", methods=["POST"])
def action():
    """
    Execute a response action.
    Input:  { "action": "block_ip", "target": "10.0.0.1", ... }
    Output: { "success": true, "action": "block_ip", "ip": "10.0.0.1" }
    """
    data = request.get_json(force=True, silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    action_type = str(data.get("action", "")).strip().lower()
    target      = str(data.get("target", "")).strip()

    if not action_type:
        return jsonify({"error": "action field is required"}), 400

    if action_type not in VALID_ACTIONS:
        return jsonify({"error": f"Unknown action '{action_type}'. Valid: {sorted(VALID_ACTIONS)}"}), 400

    logger.info(f"[ACTION] Received: action={action_type} target={target}")

    if action_type == "block_ip":
        result = _block_ip(target)
    elif action_type == "unblock_ip":
        result = _unblock_ip(target)
    elif action_type == "create_alert":
        result = _create_alert(data)
    elif action_type == "notify":
        logger.info(f"[ACTION] Notify: {data.get('message', '')}")
        result = {"success": True, "action": "notify"}

    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return jsonify(result), 200


@app.route("/blocklist", methods=["GET"])
def blocklist():
    """Return the current in-memory blocked IP list."""
    return jsonify({"blocked_ips": sorted(_blocked_ips), "count": len(_blocked_ips)}), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"[SERVER] Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    logger.info("[STARTUP] Response Engine starting on port 5004")
    app.run(host="0.0.0.0", port=5004, debug=False)
