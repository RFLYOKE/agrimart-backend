import { createClient } from 'redis';
import { env } from './env';
import logger from '../utils/logger';

export const redisClient = createClient({
  url: env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      logger.warn(`Redis reconnecting... Attempt: ${retries}`);
      // Exponential backoff, max 5 retries or max delay
      if (retries > 5) {
        logger.error('Max Redis reconnection retries reached');
        return new Error('Max retries reached');
      }
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

export const redisHelper = {
  get: async (key: string) => {
    return redisClient.get(key);
  },
  set: async (key: string, value: string, ttlSeconds?: number) => {
    if (ttlSeconds) {
      return redisClient.setEx(key, ttlSeconds, value);
    }
    return redisClient.set(key, value);
  },
  del: async (key: string) => {
    return redisClient.del(key);
  }
}

export default redisClient;
