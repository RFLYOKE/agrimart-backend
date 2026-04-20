import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import exporterService from './service';
import {
  CreateRFQInput,
  SubmitQuoteInput,
  AwardQuoteInput,
  UploadExportDocInput,
  OpenRFQFilterQuery,
  ExportDocFilterQuery,
} from './schema';
import logger from '../../utils/logger';

// ============================================
// Exporter Controller
// ============================================

export class ExporterController {

  /**
   * POST /exporter/rfq
   */
  createRFQ = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateRFQInput.parse(req.body);
      const result = await exporterService.createRFQ(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'RFQ berhasil dibuat', data: result });
    } catch (error: any) {
      logger.error('Create RFQ Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /rfq/open (For Koperasi mostly)
   */
  getOpenRFQs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = OpenRFQFilterQuery.parse(req.query);
      const result = await exporterService.getOpenRFQs(parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /exporter/rfq/my
   */
  getMyRFQs = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await exporterService.getMyRFQs(req.user!.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /exporter/rfq/:id
   */
  getRFQDetail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await exporterService.getRFQDetail(id, req.user!.id, req.user!.role);
      res.json({ success: true, data: result });
    } catch (error: any) {
      const status = error.message.includes('tidak ditemukan') ? 404 : 403;
      res.status(status).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /rfq/:id/quote (For Koperasi)
   */
  submitQuote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = SubmitQuoteInput.parse({ ...req.body, rfq_id: req.params.id });
      const result = await exporterService.submitQuote(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'Penawaran berhasil dikirim', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * PUT /exporter/rfq/:id/award
   */
  awardQuote = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = AwardQuoteInput.parse({ rfq_id: req.params.id, quote_id: req.body.quote_id });
      const result = await exporterService.awardQuote(req.user!.id, parsed);
      res.json({ success: true, message: result.message });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * POST /exporter/documents
   */
  uploadDocument = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = UploadExportDocInput.parse(req.body);
      const result = await exporterService.uploadExportDoc(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'Dokumen berhasil diunggah', data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /exporter/documents
   */
  getDocuments = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ExportDocFilterQuery.parse(req.query);
      const result = await exporterService.getMyExportDocs(req.user!.id, parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /exporter/currency/rates
   */
  getCurrencyRates = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rates = await exporterService.fetchLatestRates();
      res.json({ success: true, data: rates });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
}

export default new ExporterController();
