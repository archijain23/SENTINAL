# sentinal-middleware

> AI-powered Express.js middleware for rate limiting and request validation — extracted from the [SENTINAL WAF](https://github.com/archijain23/SENTINAL) project.

## Install

```bash
npm install sentinal-middleware
```

## Usage

```js
const express = require('express');
const Joi = require('joi');
const { ingestLimiter, globalLimiter, validate } = require('sentinal-middleware');

const app = express();
app.use(express.json());

// Apply global rate limiter to all routes
app.use(globalLimiter);

// Define a Joi validation schema
const reportSchema = Joi.object({
  ip: Joi.string().ip().required(),
  attackType: Joi.string().valid('sqli', 'xss', 'brute_force').required(),
  payload: Joi.string().max(2000).optional()
});

// Apply ingest limiter + validate on a specific route
app.post('/api/report', ingestLimiter, validate(reportSchema), (req, res) => {
  res.json({ success: true, received: req.body });
});

app.listen(3000);
```

## API

### `ingestLimiter`
Express middleware. Limits to **100 requests per IP per minute**. Best for sensitive ingest/report routes.

### `globalLimiter`
Express middleware. Limits to **300 requests per IP per minute**. Best applied globally.

### `validate(schema)`
Express middleware factory. Validates `req.body` against a [Joi](https://joi.dev) schema. Returns `400` with error details on failure.

| Parameter | Type | Description |
|-----------|------|-------------|
| `schema` | `Joi.Schema` | Any Joi object schema |

## Peer Dependencies

| Package | Version |
|---------|---------|
| `express` | `>=4.0.0` |

## Part of SENTINAL

This package is the publishable middleware layer of the [SENTINAL](https://github.com/archijain23/SENTINAL) project — an AI-powered real-time WAF built at HackByte 4.0.

## License

MIT
