import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import adminService from './service';
import {
  UserFilterQuery,
  AnalyticsQuery,
  ClaimFilterQuery,
  VerifyCoopInput,
  UpdateUserStatusInput,
} from './schema';
import logger from '../../utils/logger';

// ============================================
// Admin Controller — Request Handler Layer
// Semua endpoint memerlukan authenticate + adminOnly
// ============================================

export class AdminController {

  /**
   * GET /admin/stats
   * Dashboard overview — semua statistik platform dalam satu panggilan
   */
  getStats = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await adminService.getPlatformStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error('Admin Stats Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /admin/users
   * List semua user dengan filter role, status, search, pagination
   */
  getUsers = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UserFilterQuery.parse(req.query);
      const result = await adminService.getAllUsers(parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Admin Get Users Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /admin/users/:id
   * Detail lengkap satu user (profil, orders, info koperasi jika ada)
   */
  getUserDetail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await adminService.getUserDetail(id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Admin Get User Detail Error:', error);
      const statusCode = error.message === 'User tidak ditemukan' ? 404 : 500;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  };

  /**
   * PUT /admin/users/:id/status
   * Update status user: active | suspended | banned
   */
  updateUserStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = UpdateUserStatusInput.parse(req.body);
      const result = await adminService.updateUserStatus(req.user!.id, id, parsed);
      res.json({ success: true, message: `Status user berhasil diubah ke ${parsed.status}`, data: result });
    } catch (error: any) {
      logger.error('Admin Update User Status Error:', error);
      const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400;
      res.status(statusCode).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /admin/cooperatives/pending
   * List koperasi yang menunggu verifikasi admin
   */
  getPendingCooperatives = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await adminService.getPendingCooperatives();
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Admin Get Pending Coops Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PUT /admin/cooperatives/verify
   * Approve atau reject verifikasi koperasi
   */
  verifyCooperative = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = VerifyCoopInput.parse(req.body);
      const result = await adminService.verifyCooperative(req.user!.id, parsed);
      res.json({
        success: true,
        message: `Koperasi "${result.coopName}" berhasil di-${result.action}`,
        data: result,
      });
    } catch (error: any) {
      logger.error('Admin Verify Cooperative Error:', error);
      const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400;
      res.status(statusCode).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /admin/claims
   * Semua klaim Fresh Guarantee dengan filter status
   */
  getClaims = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ClaimFilterQuery.parse(req.query);
      const result = await adminService.getAllClaims(parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Admin Get Claims Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /admin/analytics
   * Data analytics untuk charts: revenue, top products, top coops, distribusi
   */
  getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AnalyticsQuery.parse(req.query);
      const result = await adminService.getPlatformAnalytics(parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Admin Get Analytics Error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  };
}

export default new AdminController();
