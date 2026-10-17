import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as firebase from '../services/firebase.js';
import { usernameSchema, setUsernameSchema } from '../validation.js';

const router = express.Router();

/**
 * POST /api/users/username
 * Set or update username for authenticated user
 */
router.post('/username', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const { username } = setUsernameSchema.parse(req.body);

    // Check if username is already taken
    const existingUser = await firebase.getUserByUsername(username);
    if (existingUser && existingUser.uid !== uid) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Set username
    await firebase.setUsername(uid, username);

    const user = await firebase.getUser(uid);
    res.json({
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/search?username=
 * Search for user by username (exact match)
 * Returns uid, username, displayName (no email)
 */
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username query parameter is required' });
    }

    const user = await firebase.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Never expose email per spec §3.6
    res.json({
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/users/me
 * Get current authenticated user's profile
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const user = await firebase.getUser(uid);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      uid: user.uid,
      username: user.username,
      displayName: user.displayName,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
