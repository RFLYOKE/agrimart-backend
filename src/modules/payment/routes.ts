import { Router } from 'express';
import { PaymentController } from './controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new PaymentController();

// Midtrans webhook (public - no auth, relies on signature verification inside)
router.post('/webhook', controller.handleWebhook);

// Check transaction status directly
router.get('/status/:orderId', authenticate, controller.checkStatus);

export default router;
