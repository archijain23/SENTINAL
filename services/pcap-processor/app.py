"""
PCAP Processor — SENTINAL microservice
Stage 2: Basic Functionality — /upload POST endpoint with file validation.
"""

import os
import logging
from flask import Flask, jsonify, request
from werkzeug.utils import secure_filename

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


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "pcap-processor"})


@app.route("/upload", methods=["POST"])
def upload():
    """
    Accepts a .pcap or .pcapng file upload.
    Field name: 'file'
    Returns a placeholder analysis result (real parsing in Stage 3).
    """
    if "file" not in request.files:
        logger.warning("[UPLOAD] No file field in request")
        return jsonify({"error": "No file field in request"}), 400

    f = request.files["file"]

    if f.filename == "":
        logger.warning("[UPLOAD] Empty filename")
        return jsonify({"error": "No file selected"}), 400

    if not _allowed_file(f.filename):
        logger.warning(f"[UPLOAD] Rejected file type: {f.filename}")
        return jsonify({"error": "Only .pcap and .pcapng files are allowed"}), 400

    filename = secure_filename(f.filename)
    save_path = os.path.join(UPLOAD_FOLDER, filename)
    f.save(save_path)

    file_size = os.path.getsize(save_path)
    if file_size > MAX_FILE_BYTES:
        os.remove(save_path)
        logger.warning(f"[UPLOAD] File too large: {file_size} bytes")
        return jsonify({"error": "File exceeds 50MB limit"}), 413

    logger.info(f"[UPLOAD] Received: {filename} ({file_size} bytes)")

    # Stage 2: placeholder — real Scapy parsing comes in Stage 3
    return jsonify({
        "status":   "received",
        "filename": filename,
        "size":     file_size,
        "packets":  None,
        "events":   []
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
