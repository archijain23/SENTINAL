"""
Nexus AI Agent — SENTINAL microservice
Stage 2 + 3: /query endpoint with real Gemini AI integration.
"""

import os
import logging
from flask import Flask, jsonify, request
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

try:
    import google.generativeai as genai
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    if GEMINI_API_KEY:
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel("gemini-1.5-flash")
        GEMINI_AVAILABLE = True
    else:
        GEMINI_AVAILABLE = False
except ImportError:
    GEMINI_AVAILABLE = False
    _model = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("nexus-agent")

app = Flask(__name__)

SYSTEM_PROMPT = """You are Nexus, an expert AI security analyst embedded in the SENTINAL
cybersecurity platform. You analyze attack events, network logs, and threat data.
Always respond concisely in JSON format with keys: summary, severity, recommendations.
Severity must be one of: low, medium, high, critical."""


def _build_prompt(context):
    attack_type = context.get("attack_type", "unknown")
    src_ip      = context.get("src_ip", "unknown")
    event_count = context.get("event_count", 1)
    extra       = context.get("details", "")

    return (
        f"Analyze this security event:\n"
        f"- Attack type: {attack_type}\n"
        f"- Source IP: {src_ip}\n"
        f"- Event count: {event_count}\n"
        f"- Details: {extra}\n\n"
        f"Respond ONLY with valid JSON matching this schema:\n"
        f'{{"summary": "...", "severity": "low|medium|high|critical", '
        f'"recommendations": ["...", "..."]}}'
    )


@app.route("/health")
def health():
    return jsonify({
        "status":           "ok",
        "service":          "nexus-agent",
        "gemini_available": GEMINI_AVAILABLE
    })


@app.route("/query", methods=["POST"])
def query():
    """
    Accepts a security context and returns AI analysis.
    Input: { "attack_type": "brute_force", "src_ip": "...", "event_count": 5 }
    Output: { "summary": "...", "severity": "high", "recommendations": [...] }
    """
    data = request.get_json(force=True, silent=True)
    if not data or not isinstance(data, dict):
        return jsonify({"error": "Invalid or missing JSON payload"}), 400

    if not GEMINI_AVAILABLE:
        logger.warning("[QUERY] Gemini not configured — returning fallback response")
        return jsonify({
            "summary":         f"Detected {data.get('attack_type', 'unknown')} activity from {data.get('src_ip', 'unknown')}.",
            "severity":        "high",
            "recommendations": [
                "Block the source IP immediately",
                "Review firewall rules",
                "Check system logs for lateral movement"
            ],
            "source": "fallback"
        }), 200

    prompt = _build_prompt(data)
    logger.info(f"[QUERY] Sending to Gemini | attack={data.get('attack_type')} | ip={data.get('src_ip')}")

    try:
        response = _model.generate_content(SYSTEM_PROMPT + "\n\n" + prompt)
        raw = response.text.strip()

        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        import json
        result = json.loads(raw)
        result["source"] = "gemini"
        logger.info(f"[QUERY] Gemini response | severity={result.get('severity')}")
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"[QUERY] Gemini error: {e}")
        return jsonify({"error": "AI analysis failed", "detail": str(e)}), 502


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(500)
def internal_error(e):
    logger.error(f"[SERVER] Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    logger.info(f"[STARTUP] Nexus Agent starting on port 5003 | Gemini: {GEMINI_AVAILABLE}")
    app.run(host="0.0.0.0", port=5003, debug=False)
