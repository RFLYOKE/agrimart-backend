import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth';

/**
 * Middleware: adminOnly
 *
 * Memastikan hanya user dengan role 'admin' yang dapat mengakses endpoint.
 * Harus digunakan SETELAH middleware `authenticate`.
 *
 * Flow:
 * 1. Cek apakah req.user sudah terisi (dari middleware authenticate)
 * 2. Cek apakah req.user.role === 'admin'
 * 3. Jika bukan admin → 403 Forbidden
 */
export const adminOnly = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Pastikan user sudah di-attach oleh middleware authenticate
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Autentikasi diperlukan.',
    });
    return;
  }

  // Cek role admin
  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      message: 'Akses ditolak. Hanya admin yang dapat mengakses resource ini.',
    });
    return;
  }

  next();
};

export default adminOnly;
