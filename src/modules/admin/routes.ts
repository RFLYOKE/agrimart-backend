import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { adminOnly } from './middleware/adminOnly';
import adminController from './controller';

const router = Router();

// ============================================
// Semua route admin memerlukan: authenticate + adminOnly
// ============================================

// Dashboard Overview
router.get('/stats', authenticate, adminOnly, adminController.getStats);

// User Management
router.get('/users', authenticate, adminOnly, adminController.getUsers);
router.get('/users/:id', authenticate, adminOnly, adminController.getUserDetail);
router.put('/users/:id/status', authenticate, adminOnly, adminController.updateUserStatus);

// Cooperative Verification
router.get('/cooperatives/pending', authenticate, adminOnly, adminController.getPendingCooperatives);
router.put('/cooperatives/verify', authenticate, adminOnly, adminController.verifyCooperative);

// Fresh Guarantee Claims
router.get('/claims', authenticate, adminOnly, adminController.getClaims);

// Analytics
router.get('/analytics', authenticate, adminOnly, adminController.getAnalytics);

export default router;
