import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../config/db';
import redisClient from '../../config/redis';
import { env } from '../../config/env';
import { otpService } from './otp.service';
import { googleService } from './google.service';
import {
  RegisterEmailInput,
  LoginEmailInput,
  VerifyOtpInput,
  GoogleAuthInput,
} from './schema';

/**
 * Auth Service — Business logic utama untuk autentikasi AgriMart
 *
 * Mendukung 3 metode login:
 * 1. Email + Password  (registerWithEmail, loginWithEmail)
 * 2. Nomor HP + OTP    (sendPhoneOtp, verifyPhoneOtp)
 * 3. Google OAuth2     (loginWithGoogle)
 *
 * Plus token management:
 * - generateTokens, refreshToken, logout
 */
export class AuthService {

  // =============================================================
  // PRIVATE HELPERS
  // =============================================================

  /**
   * Generate pasangan access token + refresh token
   *
   * - accessToken: berisi {id, role}, expired 15 menit
   * - refreshToken: berisi {id}, expired 7 hari
   * - refreshToken disimpan di Redis dengan TTL 7 hari (604800 detik)
   *
   * @returns Object berisi access_token, refresh_token, dan expires_in (detik)
   */
  private async generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { id: userId, role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    // Simpan refresh token ke Redis dengan TTL 7 hari
    await redisClient.setEx(`refresh:${userId}`, 604800, refreshToken);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 900, // 15 menit dalam detik
    };
  }

  /**
   * Helper: Buat Cooperative record untuk role koperasi
   */
  private async createCooperativeForUser(tx: any, userId: string, name: string) {
    await tx.cooperative.create({
      data: {
        user_id: userId,
        name: `${name} Cooperative`,
        location: 'Belum ditentukan',
        sector: 'pertanian',
        description: null,
        cert_status: 'pending',
      },
    });
  }

  /**
   * Helper: Format user response (tanpa password_hash)
   */
  private formatUserResponse(user: any) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
    };
  }

  // =============================================================
  // 1. EMAIL + PASSWORD
  // =============================================================

  /**
   * Register user baru dengan email dan password
   *
   * - Cek email belum terdaftar
   * - Hash password dengan bcrypt (salt 12)
   * - Buat User record
   * - Jika role = koperasi: buat Cooperative record
   * - Generate dan return token pair + user info
   */
  async registerWithEmail(data: RegisterEmailInput) {
    // Cek apakah email sudah terdaftar
    const existingUser = await (prisma.user as any).findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email sudah terdaftar. Silakan login atau gunakan email lain.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Buat user dalam transaction (untuk memastikan konsistensi cooperative)
    const user = await (prisma as any).$transaction(async (tx: any) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password_hash: hashedPassword,
          phone: data.phone || null,
          role: data.role,
        },
      });

      // Jika role = koperasi, buat cooperative record
      if (data.role === 'koperasi') {
        await this.createCooperativeForUser(tx, newUser.id, data.name);
      }

      return newUser;
    });

    // Generate token pair
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: this.formatUserResponse(user),
      ...tokens,
    };
  }

  /**
   * Login dengan email dan password
   *
   * - Cari user by email
   * - Bandingkan password dengan bcrypt.compare
   * - Validasi status user = 'active'
   * - Generate dan return token pair + user info
   */
  async loginWithEmail(data: LoginEmailInput) {
    // Cari user berdasarkan email
    const user = await (prisma.user as any).findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Email atau password salah.');
    }

    // User yang register via Google/phone mungkin tidak punya password
    if (!user.password_hash) {
      throw new Error('Akun ini terdaftar via metode lain. Gunakan Google atau OTP untuk login.');
    }

    // Bandingkan password
    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Email atau password salah.');
    }

    // Validasi status user
    if (user.status === 'suspended') {
      throw new Error('Akun Anda telah disuspend. Hubungi admin.');
    }
    if (user.status === 'banned') {
      throw new Error('Akun Anda telah dibanned secara permanen.');
    }

    // Generate token pair
    const tokens = await this.generateTokens(user.id, user.role);

    return {
      user: this.formatUserResponse(user),
      ...tokens,
    };
  }

  // =============================================================
  // 2. NOMOR HP + OTP
  // =============================================================

  /**
   * Kirim OTP ke nomor HP
   *
   * - Cek apakah nomor sudah terdaftar (untuk menentukan flow: login vs register)
   * - Panggil otpService.sendOtp(phone) untuk kirim SMS
   * - Return isNewUser flag agar Flutter tahu harus tampilkan form register atau langsung login
   */
  async sendPhoneOtp(phone: string) {
    // Cek apakah nomor HP sudah terdaftar
    const existingUser = await (prisma.user as any).findUnique({
      where: { phone },
    });

    // Kirim OTP via SMS
    await otpService.sendOtp(phone);

    return {
      is_new_user: !existingUser,
      message: 'OTP berhasil dikirim ke nomor HP Anda.',
    };
  }

  /**
   * Verifikasi OTP dan login/register user
   *
   * - Verifikasi OTP via otpService
   * - Jika user sudah ada → login flow (generate token)
   * - Jika user belum ada → register flow (wajib ada name & role, buat user baru)
   */
  async verifyPhoneOtp(data: VerifyOtpInput) {
    // 1. Verifikasi OTP
    await otpService.verifyOtp(data.phone, data.otp);

    // 2. Cek apakah user sudah terdaftar
    const existingUser = await (prisma.user as any).findUnique({
      where: { phone: data.phone },
    });

    if (existingUser) {
      // === LOGIN FLOW ===
      // Validasi status user
      if (existingUser.status === 'suspended') {
        throw new Error('Akun Anda telah disuspend. Hubungi admin.');
      }
      if (existingUser.status === 'banned') {
        throw new Error('Akun Anda telah dibanned secara permanen.');
      }

      // Update phone_verified jika belum
      if (!existingUser.phone_verified) {
        await (prisma.user as any).update({
          where: { id: existingUser.id },
          data: { phone_verified: true },
        });
      }

      const tokens = await this.generateTokens(existingUser.id, existingUser.role);

      return {
        user: this.formatUserResponse(existingUser),
        ...tokens,
        is_new_user: false,
      };
    } else {
      // === REGISTER FLOW ===
      // Validasi: name dan role wajib untuk user baru
      if (!data.name) {
        throw new Error('Nama wajib diisi untuk pendaftaran akun baru.');
      }
      if (!data.role) {
        throw new Error('Role wajib dipilih untuk pendaftaran akun baru.');
      }

      // Buat user baru
      const user = await (prisma as any).$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            name: data.name!,
            phone: data.phone,
            role: data.role!,
            phone_verified: true,
          },
        });

        // Jika role = koperasi, buat cooperative record
        if (data.role === 'koperasi') {
          await this.createCooperativeForUser(tx, newUser.id, data.name!);
        }

        return newUser;
      });

      const tokens = await this.generateTokens(user.id, user.role);

      return {
        user: this.formatUserResponse(user),
        ...tokens,
        is_new_user: true,
      };
    }
  }

  // =============================================================
  // 3. GOOGLE OAUTH2
  // =============================================================

  /**
   * Login/Register via Google OAuth2
   *
   * - Verifikasi ID token dari Google Sign-In Flutter SDK
   * - Cari user by google_id atau email
   * - Jika user sudah ada → login (update google_id jika perlu)
   * - Jika user belum ada → register baru (wajib ada role)
   */
  async loginWithGoogle(data: GoogleAuthInput) {
    // 1. Verifikasi Google ID token
    const googlePayload = await googleService.verifyGoogleToken(data.id_token);

    // 2. Cari user yang sudah ada (by google_id OR email)
    const existingUser = await (prisma.user as any).findFirst({
      where: {
        OR: [
          { google_id: googlePayload.google_id },
          { email: googlePayload.email },
        ],
      },
    });

    if (existingUser) {
      // === LOGIN FLOW ===
      // Validasi status
      if (existingUser.status === 'suspended') {
        throw new Error('Akun Anda telah disuspend. Hubungi admin.');
      }
      if (existingUser.status === 'banned') {
        throw new Error('Akun Anda telah dibanned secara permanen.');
      }

      // Update google_id jika user login pertama kali via Google (registered via email sebelumnya)
      if (!existingUser.google_id) {
        await (prisma.user as any).update({
          where: { id: existingUser.id },
          data: { google_id: googlePayload.google_id },
        });
      }

      const tokens = await this.generateTokens(existingUser.id, existingUser.role);

      return {
        user: this.formatUserResponse(existingUser),
        ...tokens,
        is_new_user: false,
      };
    } else {
      // === REGISTER FLOW ===
      // Validasi: role wajib untuk user baru
      if (!data.role) {
        throw new Error('Role wajib dipilih untuk pendaftaran akun baru via Google.');
      }

      // Buat user baru
      const user = await (prisma as any).$transaction(async (tx: any) => {
        const newUser = await tx.user.create({
          data: {
            name: googlePayload.name,
            email: googlePayload.email,
            google_id: googlePayload.google_id,
            role: data.role!,
          },
        });

        // Jika role = koperasi, buat cooperative record
        if (data.role === 'koperasi') {
          await this.createCooperativeForUser(tx, newUser.id, googlePayload.name);
        }

        return newUser;
      });

      const tokens = await this.generateTokens(user.id, user.role);

      return {
        user: this.formatUserResponse(user),
        ...tokens,
        is_new_user: true,
      };
    }
  }

  // =============================================================
  // 4. TOKEN MANAGEMENT
  // =============================================================

  /**
   * Refresh access token menggunakan refresh token
   *
   * - Verifikasi refresh token dengan JWT_REFRESH_SECRET
   * - Cek token masih tersimpan di Redis (belum logout)
   * - Bandingkan token di Redis dengan yang dikirim (harus sama persis)
   * - Generate access token baru
   */
  async refreshToken(token: string) {
    try {
      // Verifikasi JWT refresh token
      const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string };

      // Cek token di Redis
      const storedToken = await redisClient.get(`refresh:${decoded.id}`);
      if (!storedToken) {
        throw new Error('Refresh token tidak ditemukan. Silakan login ulang.');
      }

      // Pastikan token yang dikirim sama dengan yang tersimpan
      if (storedToken !== token) {
        throw new Error('Refresh token tidak valid. Silakan login ulang.');
      }

      // Ambil data user terbaru
      const user = await (prisma.user as any).findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        throw new Error('User tidak ditemukan.');
      }

      if (user.status !== 'active') {
        throw new Error('Akun Anda tidak aktif.');
      }

      // Generate access token baru saja (refresh token tetap sama)
      const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return {
        access_token: accessToken,
        expires_in: 900,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token telah expired. Silakan login ulang.');
      }
      throw error;
    }
  }

  /**
   * Logout — Hapus refresh token dari Redis
   *
   * Setelah ini, refresh token tidak bisa digunakan lagi.
   * Access token yang sudah dikeluarkan akan expired secara alami (15 menit).
   */
  async logout(userId: string) {
    await redisClient.del(`refresh:${userId}`);
    return { message: 'Berhasil logout.' };
  }
}

export const authService = new AuthService();
