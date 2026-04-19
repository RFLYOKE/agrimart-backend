import app from './app';
import { env } from './config/env';
import logger from './utils/logger';
import { initSocket } from './config/socket';
import { consultSocketHandler } from './modules/consult/socket';
import { auctionSocketHandler } from './modules/auction/socket';
import { startAuctionCron } from './modules/auction/cron';

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info(`🌾 AgriMart API Server running on port ${PORT}`);
  logger.info(`📍 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 URL: http://localhost:${PORT}`);
  logger.info(`❤️  Health: http://localhost:${PORT}/api/health`);
});

// Attach Socket.io server
const io = initSocket(server);
consultSocketHandler(io);
auctionSocketHandler(io);

// Initialize Background Cron Jobs
startAuctionCron();

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    // TODO: Close database connections
    // TODO: Close Redis connections
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled rejections
process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export default server;
