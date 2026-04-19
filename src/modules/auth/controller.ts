import { Request, Response } from 'express';
import { AuthService } from './service';
import { AuthRequest } from '../../middleware/auth';
import prisma from '../../config/db';
import {
  registerEmailSchema,
  loginEmailSchema,
  sendOtpSchema,
  verifyOtpSchema,
  googleAuthSchema,
  refreshTokenSchema,
} from './schema';

const authService = new AuthService();

/**
 * Auth Controller — Menangani semua endpoint autentikasi
 *
 * Format response konsisten:
 * Sukses: { success: true, data: {...}, message: "..." }
 * Error:  { success: false, message: "...", errors: [] }
 */
export class AuthController {

  // =============================================================
  // 1. EMAIL + PASSWORD
  // =============================================================

  /**
   * POST /api/auth/register/email
   * Register user baru dengan email dan password
   */
  async registerEmail(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input dengan Zod
      const parsed = registerEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.registerWithEmail(parsed.data);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registrasi berhasil! Selamat datang di AgriMart.',
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Registrasi gagal.',
        errors: [],
      });
    }
  }

  /**
   * POST /api/auth/login/email
   * Login dengan email dan password
   */
  async loginEmail(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input
      const parsed = loginEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.loginWithEmail(parsed.data);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Login berhasil.',
      });
    } catch (error: any) {
      const statusCode = error.message.includes('suspend') || error.message.includes('banned') ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Login gagal.',
        errors: [],
      });
    }
  }

  // =============================================================
  // 2. NOMOR HP + OTP
  // =============================================================

  /**
   * POST /api/auth/otp/send
   * Kirim OTP ke nomor HP (untuk login atau register)
   */
  async sendOtp(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input
      const parsed = sendOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.sendPhoneOtp(parsed.data.phone);

      res.status(200).json({
        success: true,
        data: result,
        message: result.message,
      });
    } catch (error: any) {
      // Rate limit error (tunggu sebelum kirim ulang)
      const statusCode = error.message.includes('Tunggu') ? 429 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Gagal mengirim OTP.',
        errors: [],
      });
    }
  }

  /**
   * POST /api/auth/otp/verify
   * Verifikasi OTP dan login/register user
   */
  async verifyOtp(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.verifyPhoneOtp(parsed.data);

      const message = result.is_new_user
        ? 'Registrasi berhasil! Selamat datang di AgriMart.'
        : 'Login berhasil.';

      res.status(result.is_new_user ? 201 : 200).json({
        success: true,
        data: result,
        message,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Verifikasi OTP gagal.',
        errors: [],
      });
    }
  }

  // =============================================================
  // 3. GOOGLE OAUTH2
  // =============================================================

  /**
   * POST /api/auth/google
   * Login/Register via Google OAuth2
   */
  async googleAuth(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input
      const parsed = googleAuthSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.loginWithGoogle(parsed.data);

      const message = result.is_new_user
        ? 'Registrasi via Google berhasil! Selamat datang di AgriMart.'
        : 'Login via Google berhasil.';

      res.status(result.is_new_user ? 201 : 200).json({
        success: true,
        data: result,
        message,
      });
    } catch (error: any) {
      const statusCode = error.message.includes('suspend') || error.message.includes('banned') ? 403 : 401;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Login via Google gagal.',
        errors: [],
      });
    }
  }

  // =============================================================
  // 4. TOKEN MANAGEMENT
  // =============================================================

  /**
   * POST /api/auth/refresh
   * Refresh access token menggunakan refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      // Validasi input
      const parsed = refreshTokenSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: 'Validasi input gagal.',
          errors: parsed.error.issues.map((e: any) => ({ field: e.path.join('.'), message: e.message })),
        });
        return;
      }

      const result = await authService.refreshToken(parsed.data.refresh_token);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Token berhasil diperbarui.',
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Gagal memperbarui token.',
        errors: [],
      });
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user — hapus refresh token dari Redis
   */
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Autentikasi diperlukan.',
          errors: [],
        });
        return;
      }

      await authService.logout(userId);

      res.status(200).json({
        success: true,
        data: null,
        message: 'Berhasil logout.',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Logout gagal.',
        errors: [],
      });
    }
  }

  // =============================================================
  // 5. USER PROFILE
  // =============================================================

  /**
   * GET /api/auth/me
   * Ambil data profil user yang sedang login (dari DB, bukan dari token)
   */
  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Autentikasi diperlukan.',
          errors: [],
        });
        return;
      }

      // Query lengkap dari database (termasuk cooperative jika role = koperasi)
      const user = await (prisma.user as any).findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          phone_verified: true,
          google_id: true,
          created_at: true,
          cooperative: {
            select: {
              id: true,
              name: true,
              sector: true,
              location: true,
              cert_status: true,
              fresh_rate: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User tidak ditemukan.',
          errors: [],
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          ...user,
          has_password: !!user.password_hash,
          has_google: !!user.google_id,
        },
        message: 'Data profil berhasil diambil.',
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Gagal mengambil data profil.',
        errors: [],
      });
    }
  }
}
