/**
 * SENTINAL — Geo-IP Intelligence Routes
 * ===========================================
 * GET /api/geo/heatmap     — country-level heatmap (aggregated)
 * GET /api/geo/threats     — recent attack events with geo data (GeoPage feed)
 * GET /api/geo/top-sources — top attacking IPs by event count
 * GET /api/geo/ip/:ip      — single-IP geo lookup (MongoDB-direct)
 * GET /api/geo/stats       — summary stats: countries, TOR, proxy counts
 */

'use strict';

const express     = require('express');
const router      = express.Router();
const AttackEvent = require('../models/AttackEvent');
const logger      = require('../utils/logger');


// ── GET /api/geo/heatmap ──────────────────────────────────────────────────────
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


// ── GET /api/geo/threats ─────────────────────────────────────────────────────
// Recent AttackEvents with geo enrichment — primary data source for GeoPage.
// Returns ALL events (with or without geoIntel) so the table is never empty
// when attacks exist. Events without geoIntel show "Unknown" location and no
// map dot (lat/lng will be null).
router.get('/threats', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);

    // Aggregate per-IP: count events, take most recent geo + severity
    const pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:        '$ip',
          ip:         { $first: '$ip' },
          attackType: { $first: '$attackType' },
          severity:   { $first: '$severity' },
          status:     { $first: '$status' },
          count:      { $sum: 1 },
          lastSeen:   { $first: '$createdAt' },
          geoIntel:   { $first: '$geoIntel' },
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ];

    const results = await AttackEvent.aggregate(pipeline);

    const threats = results.map(r => {
      const g = r.geoIntel || {};
      return {
        id:         r._id,
        ip:         r.ip,
        attackType: r.attackType,
        severity:   r.severity,
        status:     r.status,
        count:      r.count,
        lastSeen:   r.lastSeen,
        country:    g.country    || 'Unknown',
        country_code: g.country_code || null,
        city:       g.city       || null,
        latitude:   g.latitude   ?? null,
        longitude:  g.longitude  ?? null,
        isp:        g.isp        || null,
        is_tor:     g.is_tor     ?? false,
        is_proxy:   g.is_proxy   ?? false,
        is_hosting: g.is_hosting ?? false,
        abuse_confidence_score: g.abuse_confidence_score ?? null,
      };
    });

    logger.info(`[GEO] threats: returned ${threats.length} unique IPs`);
    return res.json({ success: true, data: threats });
  } catch (err) {
    logger.error(`[GEO] threats error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/top-sources ─────────────────────────────────────────────────
// Top 20 IPs by event count. Same shape as /threats but limited + sorted.
router.get('/top-sources', async (req, res) => {
  try {
    const pipeline = [
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id:        '$ip',
          ip:         { $first: '$ip' },
          attackType: { $first: '$attackType' },
          severity:   { $first: '$severity' },
          count:      { $sum: 1 },
          lastSeen:   { $first: '$createdAt' },
          geoIntel:   { $first: '$geoIntel' },
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    const results = await AttackEvent.aggregate(pipeline);

    const sources = results.map(r => {
      const g = r.geoIntel || {};
      return {
        ip:         r.ip,
        attackType: r.attackType,
        severity:   r.severity,
        count:      r.count,
        lastSeen:   r.lastSeen,
        country:    g.country   || 'Unknown',
        country_code: g.country_code || null,
        city:       g.city      || null,
        latitude:   g.latitude  ?? null,
        longitude:  g.longitude ?? null,
        is_tor:     g.is_tor    ?? false,
        is_proxy:   g.is_proxy  ?? false,
        abuse_confidence_score: g.abuse_confidence_score ?? null,
      };
    });

    return res.json({ success: true, data: sources });
  } catch (err) {
    logger.error(`[GEO] top-sources error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// ── GET /api/geo/ip/:ip ────────────────────────────────────────────────────────
router.get('/ip/:ip', async (req, res) => {
  const { ip } = req.params;

  if (!ip || typeof ip !== 'string' || ip.trim() === '') {
    return res.status(400).json({ success: false, error: 'IP parameter is required' });
  }

  try {
    const event = await AttackEvent
      .findOne(
        { ip: ip.trim(), 'geoIntel.country_code': { $exists: true, $ne: null } },
        { geoIntel: 1, _id: 0 }
      )
      .sort({ createdAt: -1 })
      .lean();

    if (!event || !event.geoIntel) {
      logger.info(`[GEO] no geo data found for IP: ${ip}`);
      return res.json({ success: true, data: null });
    }

    const g = event.geoIntel;
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
