import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

// Import module routes
import authRoutes from './modules/auth/routes';
import marketplaceRoutes from './modules/marketplace/routes';
import auctionRoutes from './modules/auction/routes';
import consultRoutes from './modules/consult/routes';
import notificationRoutes from './modules/notification/routes';
import freshGuaranteeRoutes from './modules/fresh-guarantee/routes';

const app: Application = express();

// ============================================
// Global Middleware
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: env.NODE_ENV === 'development' ? '*' : [
    // Add production frontend URLs here
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request logging
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                    // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// ============================================
// Health Check
// ============================================

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: '🌾 AgriMart API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// API Routes
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/consult', consultRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/fresh-guarantee', freshGuaranteeRoutes);

// ============================================
// Error Handling
// ============================================

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last middleware)
app.use(errorHandler);

export default app;
