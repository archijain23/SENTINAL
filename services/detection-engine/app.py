"""
Detection Engine — SENTINAL microservice
Stage 3: Functional Logic — rule-based attack detection.
"""

from flask import Flask, request, jsonify
from collections import defaultdict
import time

app = Flask(__name__)

# In-memory tracking windows (resets on restart)
# Structure: { src_ip: [timestamp, timestamp, ...] }
_login_tracker   = defaultdict(list)
_port_tracker    = defaultdict(list)
_request_tracker = defaultdict(list)

# Detection thresholds
BRUTE_FORCE_THRESHOLD  = 5    # failed logins within window
PORT_SCAN_THRESHOLD    = 10   # unique ports within window
DDOS_THRESHOLD         = 100  # requests within window
TIME_WINDOW_SECONDS    = 60   # rolling 60-second window


def _prune(event_list):
    """Remove events older than the time window."""
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
    """
    Accepts a JSON log payload and returns an attack verdict.
    Expected input:
      {
        "src_ip":    "192.168.1.1",
        "event_type": "login_attempt",
        "dst_port":  22          (optional)
      }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON payload received"}), 400

    src_ip     = data.get("src_ip", "unknown")
    event_type = data.get("event_type", "")
    dst_port   = data.get("dst_port")

    verdict     = "clean"
    attack_type = None
    confidence  = 0.0

    if _detect_brute_force(src_ip, event_type):
        verdict     = "attack"
        attack_type = "brute_force"
        confidence  = 0.90
    elif _detect_port_scan(src_ip, dst_port):
        verdict     = "attack"
        attack_type = "port_scan"
        confidence  = 0.85
    elif _detect_ddos(src_ip):
        verdict     = "attack"
        attack_type = "ddos"
        confidence  = 0.95

    return jsonify({
        "verdict":     verdict,
        "attack_type": attack_type,
        "confidence":  confidence,
        "src_ip":      src_ip
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
