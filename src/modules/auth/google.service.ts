import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';

/**
 * Google OAuth2 Service — Verifikasi ID token dari Flutter Google Sign-In
 *
 * Flow:
 * 1. User login via Google Sign-In di Flutter → mendapat ID token
 * 2. Flutter kirim ID token ke backend → googleService.verifyGoogleToken()
 * 3. Backend verifikasi token dengan Google API → extract user info (email, name, google_id)
 */

// Inisialisasi Google OAuth2 client
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * Payload yang dikembalikan setelah verifikasi Google token berhasil
 */
export interface GooglePayload {
  google_id: string;   // Google sub (unique identifier)
  email: string;
  name: string;
  picture?: string;    // URL foto profil Google
}

export class GoogleService {
  /**
   * Verifikasi Google ID token yang dikirim dari Flutter
   *
   * - Memanggil Google API untuk memverifikasi keaslian token
   * - Mengekstrak informasi user: google_id (sub), email, name, picture
   * - Memastikan token ditujukan untuk GOOGLE_CLIENT_ID kita
   *
   * @param idToken - ID token dari Google Sign-In SDK di Flutter
   * @returns GooglePayload dengan informasi user yang terverifikasi
   * @throws Error jika token tidak valid atau verifikasi gagal
   */
  async verifyGoogleToken(idToken: string): Promise<GooglePayload> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new Error('Payload Google token kosong.');
      }

      // Pastikan email tersedia (should always be available with default scopes)
      if (!payload.email) {
        throw new Error('Email tidak tersedia dari akun Google.');
      }

      if (!payload.sub) {
        throw new Error('Google ID (sub) tidak tersedia.');
      }

      return {
        google_id: payload.sub,
        email: payload.email,
        name: payload.name || payload.email.split('@')[0], // Fallback ke email prefix
        picture: payload.picture,
      };
    } catch (error: any) {
      // Re-throw custom errors
      if (error.message.includes('Google')) {
        throw error;
      }

      // Google API verification failed
      throw new Error('Google ID token tidak valid atau telah expired.');
    }
  }
}

export const googleService = new GoogleService();
