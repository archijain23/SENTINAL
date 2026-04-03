# Response Engine — SENTINAL Microservice

Flask-based Python microservice responsible for executing automated
response actions when attacks are detected — IP blocking, alert creation,
and gateway notifications.

---

## How to Run

### 1. Prerequisites
- Python 3.10+

### 2. Setup

```bash
cd services/response-engine

python3 -m venv venv
source venv/bin/activate   # Mac/Linux
venv\\Scripts\\activate      # Windows

pip install -r requirements.txt
```

### 3. Run

```bash
python app.py
```

Service starts on **http://localhost:5004**

---

## Endpoints

### GET /health
```bash
curl http://localhost:5004/health
```
Response:
```json
{ "status": "ok", "service": "response-engine" }
```

---

## Current Stage
**Stage 1 — Skeleton**
- `/health` endpoint ✅
- `/action` POST endpoint — coming in Stage 2
