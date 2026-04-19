import { Request, Response } from 'express';
import { paymentService } from './service';
import { successResponse, errorResponse } from '../../utils/response';

export class PaymentController {
  async handleWebhook(req: Request, res: Response): Promise<any> {
    try {
      const status = await paymentService.handleWebhook(req.body);
      
      // Midtrans expects 200 OK after receiving webhook
      return res.status(200).json({ status: 'success', processed: status });
    } catch (error: any) {
      console.error('Payment Webhook Error:', error.message);
      // Depending on error, we send 500 so Midtrans might retry, or 400 for bad request
      return errorResponse(res, error.message || 'Webhook failed', 500);
    }
  }

  async checkStatus(req: Request, res: Response): Promise<any> {
    try {
      const id = req.params.orderId as string;
      const status = await paymentService.checkTransactionStatus(id);
      
      return successResponse(res, status, 'Transaction status retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to check transaction status', 400);
    }
  }
}
