import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import configurations
import { connectDatabase, getDatabaseName } from './src/database/connection.js';
import { corsConfig } from './src/config/cors.js';
import { helmetConfig } from './src/config/helmet.js';
import { rateLimitConfig } from './src/config/rateLimit.js';
import redisManager from './src/config/redis.js';

// Import routes
import routes from './src/routes/index.js';
import paypalController from './src/controllers/procurepilot/paypalController.js';

// Import middleware
import { errorHandler } from './src/middleware/error/errorHandler.js';
import { requestLogger } from './src/middleware/logging/requestLogger.js';

// Import services
import outboxWorker from './src/services/system/outboxWorker.js';
import path from 'path';

// Configure environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet(helmetConfig));
app.use(cors(corsConfig));

// Rate limiting
app.use(rateLimitConfig);

// Logging middleware
app.use(morgan('combined'));
app.use(requestLogger);

// PayPal webhooks need the raw body for signature verification (register before JSON parser)
app.post(
  '/api/procurepilot/paypal/webhook',
  express.raw({ type: 'application/json' }),
  paypalController.webhook.bind(paypalController)
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection with error handling
    let redisStatus = 'disconnected';
    try {
      redisStatus = redisManager.isAvailable() ? 'connected' : 'disconnected';
    } catch (error) {
      console.warn('Redis health check failed:', error.message);
      redisStatus = 'error';
    }
    
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: '1.0.0',
      redis: redisStatus,
      services: {
        database: 'connected',
        redis: redisStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API routes
app.use('/api', routes);

// Local storage static files (for STORAGE_DRIVER=local)
const STORAGE_LOCAL_DIR = process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), 'storage');
app.use('/files', express.static(STORAGE_LOCAL_DIR));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log(`✅ Database connected successfully (${getDatabaseName()})`);

    // Connect to Redis (optional - server will continue without it)
    let redisConnected = false;
    try {
      redisConnected = await redisManager.connect();
      if (redisConnected) {
        console.log('✅ Redis connected successfully - Permission caching enabled');
      } else {
        console.log('⚠️ Redis not available - Running without permission caching');
      }
    } catch (error) {
      console.warn('⚠️ Redis connection failed:', error.message);
      console.log('⚠️ Running without Redis cache');
      redisConnected = false;
    }

    // Start server
    app.listen(PORT, async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔒 Permission caching: ${redisConnected ? 'Enabled' : 'Disabled'}`);
      
      if (process.env.ENABLE_OUTBOX_WORKER === 'true') {
        try {
          await outboxWorker.start();
          console.log('📦 Outbox worker started successfully');
        } catch (error) {
          console.error('❌ Failed to start outbox worker:', error.message);
        }
      } else {
        console.log('📦 Outbox worker disabled (ENABLE_OUTBOX_WORKER≠true)');
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  try {
    await outboxWorker.stop();
    await redisManager.disconnect();
  } catch (error) {
    console.warn('Shutdown cleanup failed:', error.message);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  try {
    await outboxWorker.stop();
    await redisManager.disconnect();
  } catch (error) {
    console.warn('Shutdown cleanup failed:', error.message);
  }
  process.exit(0);
});

startServer();
