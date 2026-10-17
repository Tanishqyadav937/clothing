import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { issueTurnCredentials } from '../services/turn.js';

const router = express.Router();

/**
 * GET /api/turn-credentials
 * Get time-limited TURN credentials (valid 1 hour)
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const callId = req.query.callId || 'unknown';

    const credentials = issueTurnCredentials(uid, callId);

    res.json(credentials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
