import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import services and routes
import { registerSignalingHandlers } from './services/signaling.js';
import { createUser } from './services/firebase.js';
import usersRouter from './routes/users.js';
import contactsRouter from './routes/contacts.js';
import callsRouter from './routes/calls.js';
import turnRouter from './routes/turn.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Firebase Admin SDK
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

// Check if Firebase credentials are properly configured
const hasValidCredentials = 
  serviceAccount.projectId && 
  serviceAccount.privateKey && 
  serviceAccount.clientEmail &&
  !serviceAccount.projectId.includes('test');

if (hasValidCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('[Firebase] Admin SDK initialized');
  } catch (error) {
    console.error('[Firebase] Initialization error:', error.message);
    console.warn('[Firebase] Using mock mode for development');
  }
} else {
  console.warn('[Firebase] Credentials not properly configured');
  console.warn('[Firebase] Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env');
  console.warn('[Firebase] Server will start but Firestore operations will fail');
}

// Create Express app
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.SIGNALING_SERVER_URL || 'http://localhost:3000',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter for API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Routes
app.use('/api/users', usersRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/turn-credentials', turnRouter);

// Socket.io signaling handlers
registerSignalingHandlers(io);

// Firebase auth trigger for user creation (only if initialized)
if (hasValidCredentials) {
  try {
    admin.auth().onIdTokenRevoked = async uid => {
      console.log(`[Firebase] Token revoked for user: ${uid}`);
    };
  } catch (error) {
    console.warn('[Firebase] Could not set auth callback:', error.message);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  console.log(`[Socket.io] Signaling server ready`);
  console.log(`[Environment] NODE_ENV=${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('[Server] HTTP server closed');
    process.exit(0);
  });
});

export default app;
