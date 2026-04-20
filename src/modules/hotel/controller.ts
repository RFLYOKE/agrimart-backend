import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import hotelService from './service';
import {
  CreateBulkOrderInput,
  CreateSubscriptionInput,
  CancelSubscriptionInput,
  InvoiceFilterQuery,
  BulkOrderFilterQuery,
  GenerateInvoiceInput,
} from './schema';
import logger from '../../utils/logger';

// ============================================
// Hotel Controller — Request Handler Layer
// ============================================

export class HotelController {

  /**
   * POST /hotel/bulk-orders
   */
  createBulkOrder = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateBulkOrderInput.parse(req.body);
      const result = await hotelService.createBulkOrder(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'Bulk order berhasil dibuat', data: result });
    } catch (error: any) {
      logger.error('Create Bulk Order Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /hotel/bulk-orders
   */
  getBulkOrders = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = BulkOrderFilterQuery.parse(req.query);
      const result = await hotelService.getBulkOrderHistory(req.user!.id, parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Get Bulk Orders Error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /hotel/subscriptions
   */
  createSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateSubscriptionInput.parse(req.body);
      const result = await hotelService.createSubscription(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'Kontrak langganan berhasil dibuat', data: result });
    } catch (error: any) {
      logger.error('Create Subscription Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /hotel/subscriptions
   */
  getSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await hotelService.getMySubscriptions(req.user!.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Get Subscriptions Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * PUT /hotel/subscriptions/:id/pause
   */
  pauseSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await hotelService.pauseSubscription(req.user!.id, id);
      res.json({ success: true, message: 'Langganan berhasil di-pause', data: result });
    } catch (error: any) {
      logger.error('Pause Subscription Error:', error);
      const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400;
      res.status(statusCode).json({ success: false, message: error.message });
    }
  };

  /**
   * PUT /hotel/subscriptions/:id/cancel
   */
  cancelSubscription = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const parsed = CancelSubscriptionInput.parse(req.body);
      const result = await hotelService.cancelSubscription(req.user!.id, id, parsed);
      res.json({ success: true, message: `Langganan "${result.coopName}" dibatalkan`, data: result });
    } catch (error: any) {
      logger.error('Cancel Subscription Error:', error);
      const statusCode = error.message.includes('tidak ditemukan') ? 404 : 400;
      res.status(statusCode).json({ success: false, message: error.message, errors: error.issues });
    }
  };

  /**
   * GET /hotel/invoices
   */
  getInvoices = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = InvoiceFilterQuery.parse(req.query);
      const result = await hotelService.getMyInvoices(req.user!.id, parsed);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error('Get Invoices Error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /hotel/invoices/:id
   */
  getInvoiceDetail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const invoice = await (prisma as any).invoice.findFirst({
        where: { id, hotel_id: req.user!.id },
      });
      if (!invoice) {
        res.status(404).json({ success: false, message: 'Invoice tidak ditemukan' });
        return;
      }
      res.json({
        success: true,
        data: {
          ...invoice,
          subtotal: Number(invoice.subtotal),
          tax: Number(invoice.tax),
          total: Number(invoice.total),
        },
      });
    } catch (error: any) {
      logger.error('Get Invoice Detail Error:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /hotel/invoices/generate
   */
  generateInvoice = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = GenerateInvoiceInput.parse(req.body);
      const result = await hotelService.generateMonthlyInvoice(req.user!.id, parsed);
      res.status(201).json({ success: true, message: 'Invoice berhasil di-generate', data: result });
    } catch (error: any) {
      logger.error('Generate Invoice Error:', error);
      res.status(400).json({ success: false, message: error.message, errors: error.issues });
    }
  };
}

export default new HotelController();
