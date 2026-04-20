import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import hotelController from './controller';

const router = Router();

// ============================================
// Hotel & Restoran Routes
// Semua route memerlukan: authenticate + authorize('hotel_restoran')
// ============================================

// Bulk Orders (Order Massal)
router.post('/bulk-orders', authenticate, authorize('hotel_restoran'), hotelController.createBulkOrder);
router.get('/bulk-orders', authenticate, authorize('hotel_restoran'), hotelController.getBulkOrders);

// Subscriptions (Kontrak Langganan)
router.post('/subscriptions', authenticate, authorize('hotel_restoran'), hotelController.createSubscription);
router.get('/subscriptions', authenticate, authorize('hotel_restoran'), hotelController.getSubscriptions);
router.put('/subscriptions/:id/pause', authenticate, authorize('hotel_restoran'), hotelController.pauseSubscription);
router.put('/subscriptions/:id/cancel', authenticate, authorize('hotel_restoran'), hotelController.cancelSubscription);

// Invoices
router.get('/invoices', authenticate, authorize('hotel_restoran'), hotelController.getInvoices);
router.get('/invoices/:id', authenticate, authorize('hotel_restoran'), hotelController.getInvoiceDetail);
router.post('/invoices/generate', authenticate, authorize('hotel_restoran'), hotelController.generateInvoice);

export default router;
