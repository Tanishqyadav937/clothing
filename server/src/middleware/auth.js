import admin from 'firebase-admin';

/**
 * Verify Firebase ID token and return uid
 * @param {string} token - Firebase ID token
 * @returns {Promise<string>} - Firebase UID
 * @throws {Error} - If token is invalid or verification fails
 */
export async function verifyToken(token) {
  if (!token) {
    throw new Error('Token is required');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
}

/**
 * Express middleware for token verification
 * Attaches uid to req.user
 */
export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  verifyToken(token)
    .then(uid => {
      req.user = { uid };
      next();
    })
    .catch(error => {
      res.status(401).json({ error: error.message });
    });
}
