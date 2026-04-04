/**
 * SENTINAL — Geo-IP Intelligence Routes
 * =======================================
 * GET /api/geo/heatmap    — country-level attack heatmap (aggregated from MongoDB)
 * GET /api/geo/ip/:ip     — lookup a specific IP's geo + abuse data (MongoDB-direct)
 * GET /api/geo/stats      — top attacking countries, ISPs, TOR/proxy stats
 */

const express     = require('express');
const router      = express.Router();
const AttackEvent = require('../models/AttackEvent');
const logger      = require('../utils/logger');


// ── GET /api/geo/heatmap ─────────────────────────────────────────────────────
// Aggregates attack counts per country from MongoDB AttackEvents.
// Returns data ready for Leaflet / D3 world map rendering.
router.get('/heatmap', async (req, res) => {
  try {
    const pipeline = [
      { $match: { 'geoIntel.country_code': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$geoIntel.country_code',
          country:     { $first: '$geoIntel.country' },
          lat:         { $first: '$geoIntel.latitude' },
          lng:         { $first: '$geoIntel.longitude' },
          count:       { $sum: 1 },
          critical:    { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          high:        { $sum: { $cond: [{ $eq: ['$severity', 'high']     }, 1, 0] } },
          tor_count:   { $sum: { $cond: ['$geoIntel.is_tor',   1, 0] } },
          proxy_count: { $sum: { $cond: ['$geoIntel.is_proxy', 1, 0] } },
          avg_abuse:   { $avg: '$geoIntel.abuse_confidence_score' },
        }
      },
      { $sort: { count: -1 } },
      { $limit: 200 }
    ];

    const results = await AttackEvent.aggregate(pipeline);

    const heatmap = results.map(r => ({
      country_code: r._id,
      country:      r.country,
      lat:          r.lat,
      lng:          r.lng,
      count:        r.count,
      critical:     r.critical,
      high:         r.high,
      tor_count:    r.tor_count,
      proxy_count:  r.proxy_count,
      avg_abuse:    Math.round(r.avg_abuse || 0),
    }));

    return res.json({ success: true, heatmap });
  } catch (err) {
    logger.error(`[GEO] heatmap error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/ip/:ip ───────────────────────────────────────────────────────
// Looks up geo-intel for a single IP by querying the AttackEvent collection
// directly in MongoDB. Returns the geoIntel subdocument from the most recent
// event for that IP, or { data: null } if the IP has no stored geo data yet.
//
// This route is intentionally independent of the Detection Engine microservice
// so it works correctly even when :8002 is unreachable (development / demo mode).
router.get('/ip/:ip', async (req, res) => {
  const { ip } = req.params;

  if (!ip || typeof ip !== 'string' || ip.trim() === '') {
    return res.status(400).json({ success: false, error: 'IP parameter is required' });
  }

  try {
    // Find the most recent AttackEvent for this IP that has geo data populated.
    // We project only the geoIntel subdoc to keep the query lightweight.
    const event = await AttackEvent
      .findOne(
        { ip: ip.trim(), 'geoIntel.country_code': { $exists: true, $ne: null } },
        { geoIntel: 1, _id: 0 }
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!event || !event.geoIntel) {
      // IP exists in the system but has no geo enrichment yet — not an error.
      logger.info(`[GEO] no geo data found for IP: ${ip}`);
      return res.json({ success: true, data: null });
    }

    const g = event.geoIntel;

    // Normalise to a flat shape that matches what SimulatePage consumes:
    //   log.geoIntel.country, .tor_count, .proxy_count
    const data = {
      country:                g.country               || null,
      country_code:           g.country_code          || null,
      city:                   g.city                  || null,
      latitude:               g.latitude              ?? null,
      longitude:              g.longitude             ?? null,
      isp:                    g.isp                   || null,
      org:                    g.org                   || null,
      is_tor:                 g.is_tor                ?? false,
      is_proxy:               g.is_proxy              ?? false,
      is_hosting:             g.is_hosting            ?? false,
      abuse_confidence_score: g.abuse_confidence_score ?? 0,
      // Alias counts used by SimulatePage log display
      tor_count:   g.is_tor   ? 1 : 0,
      proxy_count: g.is_proxy ? 1 : 0,
    };

    logger.info(`[GEO] ip lookup OK: ${ip} → ${data.country || 'unknown'}`);
    return res.json({ success: true, data });

  } catch (err) {
    logger.error(`[GEO] ip lookup error for ${ip}: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/stats ────────────────────────────────────────────────────────
// Top 10 attacking countries, TOR/proxy/abuse stats summary.
router.get('/stats', async (req, res) => {
  try {
    const [topCountries, threatFlags] = await Promise.all([
      AttackEvent.aggregate([
        { $match: { 'geoIntel.country_code': { $exists: true, $ne: null } } },
        { $group: { _id: '$geoIntel.country_code', country: { $first: '$geoIntel.country' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      AttackEvent.aggregate([
        { $match: { geoIntel: { $ne: null } } },
        {
          $group: {
            _id: null,
            total:            { $sum: 1 },
            tor_attacks:      { $sum: { $cond: ['$geoIntel.is_tor',     1, 0] } },
            proxy_attacks:    { $sum: { $cond: ['$geoIntel.is_proxy',   1, 0] } },
            hosting_attacks:  { $sum: { $cond: ['$geoIntel.is_hosting', 1, 0] } },
            high_abuse:       { $sum: { $cond: [{ $gte: ['$geoIntel.abuse_confidence_score', 50] }, 1, 0] } },
            unique_countries: { $addToSet: '$geoIntel.country_code' },
          }
        },
        { $project: {
          total: 1, tor_attacks: 1, proxy_attacks: 1, hosting_attacks: 1, high_abuse: 1,
          unique_countries: { $size: '$unique_countries' }
        }}
      ])
    ]);

    return res.json({
      success: true,
      top_countries: topCountries.map(c => ({ country_code: c._id, country: c.country, count: c.count })),
      threat_flags:  threatFlags[0] || {}
    });
  } catch (err) {
    logger.error(`[GEO] stats error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
