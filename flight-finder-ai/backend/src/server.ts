// ==========================================
// Express Server - Flight Finder AI
// ==========================================

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import flightRoutes from './routes/flightRoutes.js';
import weatherRoutes from './routes/weatherRoutes.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend/.env (works from any CWD)
dotenv.config({ path: join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// ==========================================
// Middleware
// ==========================================

// CORS - allow frontend to access backend
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  })
);

// JSON body parser
app.use(express.json());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  next();
});

// ==========================================
// Routes
// ==========================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      anthropic: process.env.ANTHROPIC_API_KEY ? 'connected' : 'missing_api_key',
      server: 'running',
    },
  });
});

/**
 * Mount routes
 */
app.use('/api', flightRoutes);
app.use('/api', weatherRoutes);

/**
 * 404 handler
 */
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    details: {
      path: req.path,
      method: req.method,
    },
  });
});

/**
 * Global error handler
 */
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ [Server] Unhandled error:', err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: {
      message: err.message,
      type: err.name,
    },
  });
});

// ==========================================
// Start Server
// ==========================================

const server = app.listen(PORT, () => {
  console.log('\n✈️  ========================================');
  console.log('✈️  Flight Finder AI - Backend Server');
  console.log('✈️  ========================================');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`🔧 API base URL: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🤖 AI Model: claude-sonnet-4-5-20250929`);
  console.log(`🔑 API Key: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}`);
  console.log('✈️  ========================================\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

export default app;
