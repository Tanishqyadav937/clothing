import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as firebase from '../services/firebase.js';

const router = express.Router();

/**
 * GET /api/calls/history?limit=20&offset=0
 * Get paginated call history for authenticated user
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    if (limit < 1 || offset < 0) {
      return res.status(400).json({
        error: 'Invalid limit or offset',
      });
    }

    const calls = await firebase.getCallHistory(uid, limit, offset);

    res.json({
      calls,
      limit,
      offset,
      count: calls.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
