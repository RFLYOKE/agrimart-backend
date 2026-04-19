import { Router } from 'express';
import { NotificationController } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new NotificationController();

// FCM token registration
router.post('/register-token', authenticate, controller.registerToken);

// History push notifikasi
router.get('/history', authenticate, controller.getHistory);

export default router;
