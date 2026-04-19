import midtransClient from 'midtrans-client';
import { env } from './env';

// Initialize CoreApi Client
export const coreApi = new midtransClient.CoreApi({
  isProduction: false,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});

// Initialize Snap Client
export const snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: env.MIDTRANS_SERVER_KEY,
  clientKey: env.MIDTRANS_CLIENT_KEY,
});
