# PCAP Processor — SENTINAL Microservice

Flask-based Python microservice responsible for parsing uploaded `.pcap` files and extracting network events for analysis.

---

## How to Run

### 1. Prerequisites
- Python 3.10 or higher
- pip

### 2. Setup

```bash
cd services/pcap-processor

python3 -m venv venv
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows

pip install -r requirements.txt
```

### 3. Run the service

```bash
python app.py
```

Service starts on **http://localhost:5002**

---

## Endpoints

### GET /health
```bash
curl http://localhost:5002/health
```
Response:
```json
{ "status": "ok", "service": "pcap-processor" }
```

---

## Current Stage
**Stage 1 — Skeleton**
- `/health` endpoint ✅
- PCAP upload + parse — coming in Stage 2
