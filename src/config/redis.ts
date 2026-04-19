import { createClient } from 'redis';
import { env } from './env';
import logger from '../utils/logger';

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      logger.warn(`Redis reconnecting... Attempt: ${retries}`);
      // Reconnect after 100ms * retries, max 3 seconds
      return Math.min(retries * 100, 3000);
    }
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error:', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));
redisClient.on('reconnecting', () => logger.warn('Redis Client Reconnecting...'));

// Immediately-invoked async function to connect
(async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        logger.error('Failed to connect to Redis during initialization:', error);
    }
})();

export default redisClient;
