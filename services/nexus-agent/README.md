# Nexus AI Agent — SENTINAL Microservice

Flask-based Python microservice that acts as the AI brain of SENTINAL.
Receives security context (attack events, logs) and returns AI-generated
analysis, recommendations, and threat summaries powered by Google Gemini.

---

## How to Run

### 1. Prerequisites
- Python 3.10+
- Google Gemini API key

### 2. Setup

```bash
cd services/nexus-agent

python3 -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows

pip install -r requirements.txt
```

### 3. Environment

Create a `.env` file in the project root with:
```
GEMINI_API_KEY=your_key_here
```

### 4. Run

```bash
python app.py
```

Service starts on **http://localhost:5003**

---

## Endpoints

### GET /health
```bash
curl http://localhost:5003/health
```
Response:
```json
{ "status": "ok", "service": "nexus-agent" }
```

---

## Current Stage
**Stage 1 — Skeleton**
- `/health` endpoint ✅
- `/query` AI endpoint — coming in Stage 2
