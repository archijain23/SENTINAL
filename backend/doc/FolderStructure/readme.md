backend/
├── server.js                   ← Express + Socket.IO server entry
└── src/
    ├── routes/
    │   ├── stats.js             → GET /api/stats
    │   ├── attacks.js           → GET /api/attacks/recent, GET /api/attacks/:id
    │   ├── alerts.js            → GET/PATCH /api/alerts
    │   ├── logs.js              → GET /api/logs/recent
    │   ├── blocklist.js         → GET/POST/DELETE /api/blocklist
    │   ├── actions.js           → GET/POST /api/actions/pending|history
    │   ├── nexus.js             → Full Nexus policy engine routes
    │   ├── pcap.js              → POST /api/pcap/upload, GET /api/pcap/jobs
    │   ├── geoIntel.js          → GET /api/geo/threats, /api/geo/top-sources
    │   ├── gemini.js            → POST /api/gemini/chat, /report/:id, /correlate
    │   ├── forensics.js         → GET /api/attacks/:id/forensics
    │   ├── audit.js             → GET /api/audit
    │   ├── health.js            → GET /api/health
    │   ├── serviceStatus.js     → GET /api/service-status
    │   └── stats.js             → GET /api/stats
    ├── controllers/             ← Route handler logic
    ├── models/                  ← MongoDB schemas
    ├── middleware/              ← Error, auth, rate-limit middleware
    ├── services/                ← Business logic layer
    ├── sockets/                 ← Socket.IO event emitters
    ├── utils/
    └── validators/