"""
PCAP Processor — SENTINAL microservice
Stage 1: Skeleton — Flask app entry point with minimal structure.
"""

from flask import Flask, jsonify

app = Flask(__name__)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "pcap-processor"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, debug=False)
