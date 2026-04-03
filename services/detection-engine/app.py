"""
Detection Engine — SENTINAL microservice
Stage 2: Basic Functionality — /detect POST endpoint added.
"""

from flask import Flask, request, jsonify

app = Flask(__name__)


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "detection-engine"})


@app.route("/detect", methods=["POST"])
def detect():
    """
    Accepts a JSON log payload and returns a basic verdict.
    Expected input: { "src_ip": "...", "event_type": "...", "payload": "..." }
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "No JSON payload received"}), 400

    # Stage 2: always return clean — real logic comes in Stage 3
    return jsonify({
        "verdict": "clean",
        "confidence": 0.0,
        "attack_type": None,
        "received": data
    }), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
