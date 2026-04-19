import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment Variables Schema
 * Validasi ketat menggunakan Zod — server tidak akan start jika ada yang kurang
 */
const envSchema = z.object({
  // Server
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database & Cache
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT Authentication
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),

  // Midtrans Payment Gateway
  MIDTRANS_SERVER_KEY: z.string().min(1, 'MIDTRANS_SERVER_KEY is required'),
  MIDTRANS_CLIENT_KEY: z.string().min(1, 'MIDTRANS_CLIENT_KEY is required'),
  MIDTRANS_IS_PRODUCTION: z.string()
    .default('false')
    .transform((val) => val === 'true'),

  // Firebase Cloud Messaging
  FCM_SERVICE_ACCOUNT: z.string().min(1, 'FCM_SERVICE_ACCOUNT is required'),

  // AWS S3 Storage
  AWS_S3_BUCKET: z.string().min(1, 'AWS_S3_BUCKET is required'),
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),

  // Exchange Rate
  EXCHANGE_RATE_API_KEY: z.string().min(1, 'EXCHANGE_RATE_API_KEY is required'),

  // Twilio SMS (untuk OTP)
  TWILIO_ACCOUNT_SID: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'TWILIO_PHONE_NUMBER is required'),

  // Google OAuth2 (untuk verifikasi ID token dari Flutter Google Sign-In)
  GOOGLE_CLIENT_ID: z.string().default(''),

  // Apple Sign In (opsional, untuk masa depan)
  APPLE_CLIENT_ID: z.string().default(''),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  throw new Error('Environment variables validation failed. Please check your .env file.');
}

export const env = _env.data;
