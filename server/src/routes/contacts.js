import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as firebase from '../services/firebase.js';
import { contactActionSchema, contactResponseSchema } from '../validation.js';

const router = express.Router();

/**
 * GET /api/contacts
 * Get authenticated user's contact list
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const contacts = await firebase.getContacts(uid);

    res.json({ contacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/contacts/request
 * Send contact request to another user
 */
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const { username } = contactActionSchema.parse(req.body);

    if (username === (await firebase.getUser(uid))?.username) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    const targetUid = await firebase.requestContact(uid, username);

    res.json({
      success: true,
      message: 'Contact request sent',
      targetUid,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    if (error.message === 'User not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/contacts/respond
 * Respond to contact request (accept or decline)
 */
router.post('/respond', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const { username, action } = contactResponseSchema.parse(req.body);

    // Find target user
    const targetUser = await firebase.getUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUid = targetUser.uid;

    // Respond to contact
    await firebase.respondToContact(uid, targetUid, action);

    res.json({
      success: true,
      message: `Contact request ${action}ed`,
      targetUid,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/contacts/block
 * Block a user
 */
router.post('/block', authMiddleware, async (req, res) => {
  try {
    const { uid } = req.user;
    const { username } = contactActionSchema.parse(req.body);

    // Find target user
    const targetUser = await firebase.getUserByUsername(username);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUid = targetUser.uid;

    // Block user
    await firebase.blockContact(uid, targetUid);

    res.json({
      success: true,
      message: 'User blocked',
      targetUid,
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
