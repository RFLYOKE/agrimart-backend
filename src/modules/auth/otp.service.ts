import twilio from 'twilio';
import redisClient from '../../config/redis';
import { env } from '../../config/env';

/**
 * OTP Service — Mengelola pengiriman dan verifikasi OTP via SMS Twilio
 *
 * Flow:
 * 1. User request OTP → sendOtp() → generate 6 digit, simpan di Redis (TTL 5 menit), kirim SMS
 * 2. User submit OTP → verifyOtp() → bandingkan dengan Redis, hapus jika cocok
 */

// Lazy-initialize Twilio client (hanya dibuat saat benar-benar dibutuhkan)
// Mencegah crash saat startup jika credential belum diset
let _twilioClient: any = null;
function getTwilioClient() {
  if (!_twilioClient) {
    _twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  return _twilioClient;
}

// Konstanta
const OTP_TTL = 300;         // 5 menit dalam detik
const OTP_COOLDOWN = 60;     // Cooldown 60 detik sebelum bisa kirim ulang
const REDIS_OTP_PREFIX = 'otp:';
const REDIS_COOLDOWN_PREFIX = 'otp_cooldown:';

export class OtpService {
  /**
   * Kirim OTP ke nomor HP via SMS
   *
   * - Generate 6 digit OTP secara random
   * - Cek rate limit: apakah sudah ada OTP aktif dengan cooldown
   * - Simpan OTP ke Redis dengan TTL 5 menit
   * - Kirim SMS via Twilio
   *
   * @param phone - Nomor HP format +62xxx
   * @throws Error jika masih dalam cooldown period
   */
  async sendOtp(phone: string): Promise<{ message: string }> {
    // 1. Rate limit: cek apakah masih dalam cooldown
    const cooldownKey = `${REDIS_COOLDOWN_PREFIX}${phone}`;
    const existingCooldown = await redisClient.get(cooldownKey);

    if (existingCooldown) {
      const ttl = await redisClient.ttl(cooldownKey);
      throw new Error(`Tunggu ${ttl} detik sebelum mengirim OTP lagi.`);
    }

    // 2. Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. Simpan OTP ke Redis dengan TTL 5 menit
    const otpKey = `${REDIS_OTP_PREFIX}${phone}`;
    await redisClient.setEx(otpKey, OTP_TTL, otp);

    // 4. Set cooldown 60 detik untuk rate limiting
    await redisClient.setEx(cooldownKey, OTP_COOLDOWN, '1');

    // 5. Kirim SMS via Twilio
    try {
      await getTwilioClient().messages.create({
        body: `Kode OTP AgriMart Anda: ${otp}. Berlaku 5 menit. Jangan bagikan ke siapapun.`,
        from: env.TWILIO_PHONE_NUMBER,
        to: phone,
      });
    } catch (error: any) {
      // Jika Twilio gagal, tetap return sukses di development (OTP sudah tersimpan di Redis)
      if (env.NODE_ENV === 'development') {
        console.warn(`⚠️ [DEV MODE] Twilio SMS gagal terkirim. OTP untuk ${phone}: ${otp}`);
      } else {
        // Di production, hapus OTP dan cooldown lalu throw error
        await redisClient.del(otpKey);
        await redisClient.del(cooldownKey);
        throw new Error('Gagal mengirim SMS. Silakan coba lagi.');
      }
    }

    return {
      message: 'OTP berhasil dikirim ke nomor HP Anda.',
    };
  }

  /**
   * Verifikasi OTP yang di-input user
   *
   * - Ambil OTP dari Redis berdasarkan nomor HP
   * - Bandingkan dengan OTP yang dikirim user
   * - Jika cocok: hapus dari Redis, return true
   * - Jika tidak cocok atau expired: throw error
   *
   * @param phone - Nomor HP format +62xxx
   * @param otp - 6 digit OTP dari user
   * @returns true jika OTP valid
   * @throws Error jika OTP tidak valid atau expired
   */
  async verifyOtp(phone: string, otp: string): Promise<boolean> {
    const otpKey = `${REDIS_OTP_PREFIX}${phone}`;
    const storedOtp = await redisClient.get(otpKey);

    // OTP tidak ditemukan (sudah expired atau belum pernah dikirim)
    if (!storedOtp) {
      throw new Error('OTP expired atau tidak valid. Silakan minta OTP baru.');
    }

    // OTP tidak cocok
    if (storedOtp !== otp) {
      throw new Error('OTP yang Anda masukkan salah.');
    }

    // OTP cocok — hapus dari Redis agar tidak bisa digunakan lagi
    await redisClient.del(otpKey);

    return true;
  }
}

export const otpService = new OtpService();
