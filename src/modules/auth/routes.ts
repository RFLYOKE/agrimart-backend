import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const authController = new AuthController();

/**
 * Rate limiter khusus untuk endpoint OTP
 * Max 3 request per 15 menit per IP — mencegah spam SMS
 */
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 menit
  max: 3,                      // maksimal 3 request
  message: {
    success: false,
    message: 'Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit.',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter umum untuk endpoint auth (login/register)
 * Max 10 request per 15 menit per IP — mencegah brute force
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 menit
  max: 10,                     // maksimal 10 request
  message: {
    success: false,
    message: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.',
    errors: [],
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// =============================================================
// PUBLIC ROUTES (tidak perlu login)
// =============================================================

// Email + Password
router.post('/register/email', authRateLimiter, authController.registerEmail);
router.post('/login/email', authRateLimiter, authController.loginEmail);

// Nomor HP + OTP
router.post('/otp/send', otpRateLimiter, authController.sendOtp);
router.post('/otp/verify', authRateLimiter, authController.verifyOtp);

// Google OAuth2
router.post('/google', authRateLimiter, authController.googleAuth);

// Token refresh (public karena access token sudah expired saat dipanggil)
router.post('/refresh', authController.refreshToken);

// =============================================================
// PROTECTED ROUTES (harus login)
// =============================================================

// Logout
router.post('/logout', authenticate, authController.logout);

// Get current user profile
router.get('/me', authenticate, authController.getMe);

export default router;
