"""
PCAP Processor — SENTINAL microservice
Stage 3: Functional Logic — Scapy-based packet parsing.
"""

import os
import logging
from collections import defaultdict
from flask import Flask, jsonify, request
from werkzeug.utils import secure_filename

try:
    from scapy.all import rdpcap, IP, TCP, UDP, ICMP
    SCAPY_AVAILABLE = True
except ImportError:
    SCAPY_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("pcap-processor")

app = Flask(__name__)

UPLOAD_FOLDER  = "/tmp/pcap_uploads"
ALLOWED_EXTS   = {".pcap", ".pcapng"}
MAX_FILE_BYTES = 50 * 1024 * 1024  # 50 MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def _allowed_file(filename):
    _, ext = os.path.splitext(filename.lower())
    return ext in ALLOWED_EXTS


def _parse_pcap(filepath):
    """
    Parse a pcap file using Scapy.
    Returns summary dict: packet_count, unique_src_ips, unique_dst_ips,
    protocols, top_ports, and extracted events.
    """
    if not SCAPY_AVAILABLE:
        return {"error": "Scapy not installed"}

    try:
        packets = rdpcap(filepath)
    except Exception as e:
        logger.error(f"[PARSE] Failed to read pcap: {e}")
        return {"error": f"Failed to parse file: {str(e)}"}

    total        = len(packets)
    src_ips      = set()
    dst_ips      = set()
    protocols    = defaultdict(int)
    dst_ports    = defaultdict(int)
    events       = []

    for pkt in packets:
        if IP not in pkt:
            continue

        src = pkt[IP].src
        dst = pkt[IP].dst
        src_ips.add(src)
        dst_ips.add(dst)

        if TCP in pkt:
            proto = "TCP"
            port  = pkt[TCP].dport
            dst_ports[port] += 1
        elif UDP in pkt:
            proto = "UDP"
            port  = pkt[UDP].dport
            dst_ports[port] += 1
        elif ICMP in pkt:
            proto = "ICMP"
            port  = None
        else:
            proto = "OTHER"
            port  = None

        protocols[proto] += 1

        events.append({
            "src_ip":   src,
            "dst_ip":   dst,
            "protocol": proto,
            "dst_port": port
        })

    # Top 10 most-hit destination ports
    top_ports = sorted(dst_ports.items(), key=lambda x: x[1], reverse=True)[:10]

    logger.info(f"[PARSE] {total} packets | {len(src_ips)} src IPs | protocols: {dict(protocols)}")

    return {
        "packet_count":   total,
        "unique_src_ips": list(src_ips),
        "unique_dst_ips": list(dst_ips),
        "protocols":      dict(protocols),
        "top_ports":      [{"port": p, "count": c} for p, c in top_ports],
        "events":         events[:500]  # cap at 500 events
    }


@app.route("/health")
def health():
    return jsonify({
        "status":          "ok",
        "service":         "pcap-processor",
        "scapy_available": SCAPY_AVAILABLE
    })


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        logger.warning("[UPLOAD] No file field in request")
        return jsonify({"error": "No file field in request"}), 400

    f = request.files["file"]

    if f.filename == "":
        return jsonify({"error": "No file selected"}), 400

    if not _allowed_file(f.filename):
        logger.warning(f"[UPLOAD] Rejected file type: {f.filename}")
        return jsonify({"error": "Only .pcap and .pcapng files are allowed"}), 400

    filename  = secure_filename(f.filename)
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    f.save(save_path)

    file_size = os.path.getsize(save_path)
    if file_size > MAX_FILE_BYTES:
        os.remove(save_path)
        return jsonify({"error": "File exceeds 50MB limit"}), 413

    logger.info(f"[UPLOAD] Processing: {filename} ({file_size} bytes)")

    result = _parse_pcap(save_path)

    # Clean up temp file after parsing
    try:
        os.remove(save_path)
    except OSError:
        pass

    if "error" in result:
        return jsonify(result), 422

    return jsonify({
        "status":   "parsed",
        "filename": filename,
        "size":     file_size,
        **result
    }), 200


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"[SERVER] Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    logger.info("[STARTUP] PCAP Processor starting on port 5002")
    app.run(host="0.0.0.0", port=5002, debug=False)
