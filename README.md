<div align="center">

# 🛡️ SENTINAL

**AI-Powered Web Application Firewall & Intrusion Detection System**

[![Built for HackByte 4.0](https://img.shields.io/badge/HackByte-4.0-ff6b35?style=for-the-badge)](https://hackbyte.in)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com)

*Real-time attack detection → AI-powered response → Human-in-the-loop enforcement*

</div>

---

## 🎯 What is SENTINAL?

SENTINAL is a **production-grade, AI-augmented security platform** that sits in front of your web application and provides:

- 🔍 **Real-time traffic inspection** — every HTTP request scanned for SQLi, XSS, path traversal, command injection, brute force, and more
- 🤖 **AI threat scoring** — ML-based confidence scoring + Gemini AI forensic analysis
- ⚡ **Automated response** — low-risk threats handled autonomously; high-risk actions require human approval
- 🧠 **Nexus Policy Engine** — Python-based agent that enforces `rate_limit_ip`, `permanent_ban_ip`, `shutdown_endpoint` policies
- 👁️ **Live dashboard** — real-time WebSocket-powered React UI showing attacks, blocklist, audit logs, AI copilot
- 🚫 **IP Blocklist** — manual and automated blocking with TTL expiry, visible and manageable from the dashboard

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INCOMING TRAFFIC                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   Node.js Gateway :3000  │  ← Express + Socket.IO
              │   (Middleware Layer)     │  ← BlockedIP Check (MongoDB)
              └────────────┬────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
  ┌────────▼───────┐  ┌───▼────┐  ┌──────▼───────┐
  │ Detection Eng. │  │MongoDB │  │  Nexus Engine │
  │  Python :8002  │  │ Atlas  │  │  Python :8004 │
  │  (ML Scoring)  │  │        │  │ (Policy Guard)│
  └────────────────┘  └───┬────┘  └──────────────┘
                           │
              ┌────────────▼────────────┐
              │   React Dashboard :5173  │
              │   (Vite + WebSocket)     │
              └─────────────────────────┘
```

---

## 📁 Repository Structure

```
SENTINAL/
├── README.md                    # You are here
├── .env.example                 # Environment template
├── ecosystem.config.js          # PM2 process config
├── deploy.sh                    # One-command cloud deploy
├── start.sh / stop.sh           # Local start/stop scripts
│
├── backend/                     # Node.js Gateway (Express)
│   └── src/
│       ├── controllers/         # Route handlers
│       ├── middleware/          # BlockedIP check, request logger
│       ├── models/              # MongoDB schemas
│       ├── routes/              # API route definitions
│       ├── services/            # attackService, geminiService
│       ├── sockets/             # Socket.IO broadcast
│       └── utils/               # logger, eventEmitter
│
├── services/
│   ├── detection-engine/        # Python FastAPI — ML attack scoring
│   ├── nexus-agent/             # Python FastAPI — Policy Guard agent
│   └── pcap-processor/          # Python FastAPI — PCAP file analysis
│
├── dashboard/                   # React + Vite frontend
│   └── src/
│       ├── pages/               # Route-level components
│       ├── components/          # Shared UI components
│       ├── hooks/               # useSocket, custom hooks
│       └── services/api.js      # All API calls
│
├── demo-target/                 # Vulnerable Express app (for demos)
├── postman/                     # Postman collection for API testing
├── config/                      # PM2 / Nginx configs
└── scripts/                     # Utility scripts
```

---

## ⚡ Quick Start

### Local Development
```bash
git clone https://github.com/archijain23/SENTINAL.git
cd SENTINAL && cp .env.example .env
# Fill in MONGODB_URI, GEMINI_API_KEY in .env
bash start.sh
```

---

## 🔌 Services & Ports

| Service | Tech | Port | Purpose |
|---|---|---|---|
| **Gateway** | Node.js / Express | `3000` | Main API, middleware, WebSocket |
| **Detection Engine** | Python / FastAPI | `8002` | ML-based attack classification |
| **PCAP Processor** | Python / FastAPI | `8003` | Network capture file analysis |
| **Nexus Engine** | Python / FastAPI | `8004` | Policy enforcement agent |
| **Dashboard** | React / Vite | `5173` | Web UI |

---

## 🔐 Attack Types Detected

| Attack | Detection Method | Auto-Response |
|---|---|---|
| SQL Injection | Pattern + ML scoring | `rate_limit_ip` |
| XSS | Pattern + ML scoring | `rate_limit_ip` |
| Path Traversal | Pattern matching | `rate_limit_ip` |
| Command Injection | Pattern + ML | `permanent_ban_ip` |
| Brute Force | Rate analysis | `rate_limit_ip` |
| SSRF | Pattern matching | `rate_limit_ip` |
| XXE | XML inspection | `rate_limit_ip` |
| Webshell Upload | File analysis | `permanent_ban_ip` |

---

## 🛠️ Tech Stack

**Backend:** Node.js 18, Express 4, Socket.IO, Mongoose, Axios  
**AI Services:** Python 3.11, FastAPI, scikit-learn, Google Gemini 1.5 Pro  
**Frontend:** React 18, Vite, React Router v6, Axios  
**Database:** MongoDB Atlas (hosted) or local MongoDB 7  
**Process Manager:** PM2  
**Deployment:** Ubuntu 22.04 LTS, Nginx (optional)

---

<div align="center">

Built with ❤️ for **HackByte 4.0**

</div>
