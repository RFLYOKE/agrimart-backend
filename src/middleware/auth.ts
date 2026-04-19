import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/db';

/**
 * Interface untuk Request yang telah terautentikasi
 * Digunakan di seluruh endpoint yang memerlukan login
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
}

/**
 * Middleware: authenticate
 *
 * Memverifikasi JWT Bearer token dari header Authorization.
 * - Ambil token dari header: Authorization: Bearer <token>
 * - Verifikasi JWT menggunakan JWT_SECRET
 * - Query user dari DB berdasarkan id dari payload, validasi status = 'active'
 * - Jika user suspended/banned: return 403 dengan pesan yang sesuai
 * - Attach ke req.user: {id, role, name, email, phone}
 * - Error: 401 jika token tidak ada/invalid/expired
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Ambil token dari header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token tidak ditemukan.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // 2. Verifikasi JWT
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };

    // 3. Query user dari database untuk memastikan masih aktif
    const user = await (prisma.user as any).findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, email: true, phone: true, status: true },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User tidak ditemukan. Token tidak valid.',
      });
      return;
    }

    // 4. Validasi status user
    if (user.status === 'suspended') {
      res.status(403).json({
        success: false,
        message: 'Akun Anda telah disuspend. Hubungi admin untuk informasi lebih lanjut.',
      });
      return;
    }

    if (user.status === 'banned') {
      res.status(403).json({
        success: false,
        message: 'Akun Anda telah dibanned secara permanen.',
      });
      return;
    }

    // 5. Attach user data ke request object
    req.user = {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };

    next();
  } catch (error: any) {
    // JWT expired atau tidak valid
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token telah expired. Silakan refresh token Anda.',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: 'Token tidak valid.',
    });
  }
};

/**
 * Middleware Factory: authorize
 *
 * Membuat middleware yang mengecek apakah role user ada di array roles yang diizinkan.
 * Harus digunakan setelah middleware authenticate.
 *
 * @param roles - Daftar role yang diizinkan, misal: authorize('admin', 'koperasi')
 * @returns Express middleware function
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Pastikan user sudah terautentikasi
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Autentikasi diperlukan sebelum otorisasi.',
      });
      return;
    }

    // Cek apakah role user ada di daftar yang diizinkan
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Akses ditolak untuk role '${req.user.role}'. Role yang diizinkan: ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};
