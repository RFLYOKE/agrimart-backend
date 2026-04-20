import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import exporterController from './controller';

const router = Router();

// ============================================
// Exporter Routes (/api/exporter)
// ============================================

// RFQ Management (Hanya Eksportir)
router.post('/rfq', authenticate, authorize('eksportir'), exporterController.createRFQ);
router.get('/rfq/my', authenticate, authorize('eksportir'), exporterController.getMyRFQs);
router.put('/rfq/:id/award', authenticate, authorize('eksportir'), exporterController.awardQuote);

// RFQ Details (Bisa Eksportir atau Koperasi)
// Karena auth controller menangani perbedaan response berdasarkan role internal service mem-filter
router.get('/rfq/:id', authenticate, exporterController.getRFQDetail);

// Documents
router.post('/documents', authenticate, authorize('eksportir'), exporterController.uploadDocument);
router.get('/documents', authenticate, authorize('eksportir'), exporterController.getDocuments);

// Currency 
router.get('/currency/rates', authenticate, authorize('eksportir'), exporterController.getCurrencyRates);


// ============================================
// RFQ Public / Koperasi Routes (/api/rfq)
// Catatan: Akan diregister terpisah di App.ts
// ============================================

export const rfqKoperasiRoutes = Router();

rfqKoperasiRoutes.get('/open', authenticate, authorize('koperasi'), exporterController.getOpenRFQs);
rfqKoperasiRoutes.post('/:id/quote', authenticate, authorize('koperasi'), exporterController.submitQuote);

export default router;
