# Detection Engine — SENTINAL Microservice

Flask-based Python microservice responsible for analyzing log events and returning attack verdicts.

---

## How to Run

### 1. Prerequisites
- Python 3.10 or higher
- pip

### 2. Setup

```bash
# Navigate to this directory
cd services/detection-engine

# Create a virtual environment
python3 -m venv venv

# Activate it
# On Linux/Mac:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the service

```bash
python app.py
```

Service starts on **http://localhost:5001**

---

## Endpoints

### GET /health
Returns service status.

```bash
curl http://localhost:5001/health
```

Response:
```json
{ "status": "ok", "service": "detection-engine" }
```

---

### POST /detect
Accepts a log event and returns a verdict.

```bash
curl -X POST http://localhost:5001/detect \
  -H "Content-Type: application/json" \
  -d '{"src_ip": "192.168.1.1", "event_type": "login_attempt", "payload": "test"}'
```

Response:
```json
{
  "verdict": "clean",
  "confidence": 0.0,
  "attack_type": null,
  "received": { "src_ip": "192.168.1.1", "event_type": "login_attempt", "payload": "test" }
}
```

---

## Current Stage
**Stage 2 — Basic Functionality**
- `/health` endpoint ✅
- `/detect` POST endpoint ✅ (returns `clean` verdict placeholder)
- Real detection logic — coming in Stage 3

---

## Running with the Full Stack

Make sure the Node.js Gateway's `.env` has:
```
DETECTION_URL=http://localhost:5001
```

Then start both services:
```bash
# Terminal 1 — Detection Engine
cd services/detection-engine
source venv/bin/activate
python app.py

# Terminal 2 — Gateway
cd backend
npm start
```
