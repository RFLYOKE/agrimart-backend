import { z } from 'zod';

/**
 * Daftar 5 role pengguna AgriMart
 */
const roleEnum = z.enum(['koperasi', 'konsumen', 'hotel_restoran', 'eksportir', 'admin']);

// ============================================================
// 1. REGISTER & LOGIN VIA EMAIL + PASSWORD
// ============================================================

/**
 * Schema untuk registrasi via email
 * - Password minimal 8 karakter, harus mengandung angka
 * - Role opsional, default: konsumen
 */
export const registerEmailSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/\d/, 'Password harus mengandung minimal 1 angka'),
  role: roleEnum.default('konsumen'),
  phone: z.string().optional(),
});

/**
 * Schema untuk login via email
 */
export const loginEmailSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// ============================================================
// 2. REGISTER & LOGIN VIA NOMOR HP + OTP
// ============================================================

/**
 * Schema untuk mengirim OTP ke nomor HP
 * - Format: +62... (Indonesia) atau format internasional
 */
export const sendOtpSchema = z.object({
  phone: z.string()
    .min(10, 'Nomor HP minimal 10 digit')
    .regex(/^\+62\d{8,13}$/, 'Format nomor HP harus +62xxxxxxxxxx'),
});

/**
 * Schema untuk verifikasi OTP
 * - Jika user baru (register), field name dan role wajib diisi
 * - Jika user lama (login), name dan role opsional
 */
export const verifyOtpSchema = z.object({
  phone: z.string()
    .min(10, 'Nomor HP minimal 10 digit')
    .regex(/^\+62\d{8,13}$/, 'Format nomor HP harus +62xxxxxxxxxx'),
  otp: z.string().length(6, 'OTP harus 6 digit'),
  name: z.string().min(2, 'Nama minimal 2 karakter').optional(),
  role: roleEnum.optional(),
});

// ============================================================
// 3. LOGIN VIA GOOGLE OAUTH2
// ============================================================

/**
 * Schema untuk login/register via Google
 * - id_token: didapat dari Google Sign-In SDK di Flutter
 * - role: wajib jika user baru (belum pernah login)
 */
export const googleAuthSchema = z.object({
  id_token: z.string().min(1, 'Google ID token wajib diisi'),
  role: roleEnum.optional(),
});

// ============================================================
// 4. TOKEN MANAGEMENT
// ============================================================

/**
 * Schema untuk refresh token
 */
export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token wajib diisi'),
});

// ============================================================
// EXPORT TYPE DEFINITIONS
// ============================================================

export type RegisterEmailInput = z.infer<typeof registerEmailSchema>;
export type LoginEmailInput = z.infer<typeof loginEmailSchema>;
export type SendOtpInput = z.infer<typeof sendOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// Backward compatibility aliases
export const registerSchema = registerEmailSchema;
export const loginSchema = loginEmailSchema;
export type RegisterInput = RegisterEmailInput;
export type LoginInput = LoginEmailInput;
