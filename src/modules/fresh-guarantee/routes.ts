import { Router } from 'express';
import { FreshGuaranteeController } from './controller';
import { authenticate, authorize } from '../../middleware/auth';

const router = Router();
const controller = new FreshGuaranteeController();

// Fresh Guarantee Claims
router.post('/orders/:id/confirm', authenticate, controller.confirmReceipt);
router.post('/claims', authenticate, controller.createClaim);
router.get('/claims/:id', authenticate, controller.getClaimStatus);

// Admin Actions
router.put('/claims/:id/approve', authenticate, authorize('admin'), controller.approveClaim);
router.put('/claims/:id/reject', authenticate, authorize('admin'), controller.rejectClaim);

// S3 Upload specific
router.get('/upload/presigned-url', authenticate, controller.getPresignedUrl);

// Public Metrics
router.get('/cooperatives/:id/fresh-rate', controller.getFreshRate);

export default router;
