const express = require('express');
const router  = express.Router();
const {
  getPending,
  getHistory,
  approveAction,
  rejectAction,
} = require('../controllers/actionQueueController');

// GET /api/actions/pending  — all queued items awaiting human decision
router.get('/pending', getPending);

// GET /api/actions/history?limit=50  — decided (approved/rejected) items
router.get('/history', getHistory);

// POST /api/actions/:id/approve
router.post('/:id/approve', approveAction);

// POST /api/actions/:id/reject
router.post('/:id/reject', rejectAction);

module.exports = router;
