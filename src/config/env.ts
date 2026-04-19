import dotenv from 'dotenv';

dotenv.config();

/**
 * Validasi environment variables yang wajib ada.
 */
const requiredEnvVars = [
  'PORT',
  'DATABASE_URL',
  'REDIS_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '5000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL as string,

  // Redis
  REDIS_URL: process.env.REDIS_URL as string,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,

  // Midtrans
  MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || '',
  MIDTRANS_CLIENT_KEY: process.env.MIDTRANS_CLIENT_KEY || '',

  // FCM
  FCM_SERVER_KEY: process.env.FCM_SERVER_KEY || '',

  // AWS S3
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
  AWS_REGION: process.env.AWS_REGION || '',
  AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || '',
  AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || '',

  // Helper
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};
