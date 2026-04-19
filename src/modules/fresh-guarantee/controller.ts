import { Request, Response } from 'express';
import { freshGuaranteeService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';
import { ConfirmReceiptInput, CreateClaimInput } from './schema';
import { generatePresignedUrl } from '../../utils/s3Upload';
import prisma from '../../config/db';

export class FreshGuaranteeController {
  async confirmReceipt(req: AuthRequest, res: Response): Promise<any> {
    try {
      const orderId = req.params.id as string;
      const data = ConfirmReceiptInput.parse({ ...req.body, order_id: orderId });
      
      const result = await freshGuaranteeService.confirmReceipt(req.user!.id, data);
      return successResponse(res, result, 'Order received and confirmed');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to confirm receipt', 400);
    }
  }

  async createClaim(req: AuthRequest, res: Response): Promise<any> {
    try {
      const data = CreateClaimInput.parse(req.body);
      
      const result = await freshGuaranteeService.createClaim(req.user!.id, data);
      return successResponse(res, result, 'Claim created successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create claim', 400);
    }
  }

  async getClaimStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const claim = await prisma.claim.findUnique({
        where: { id: req.params.id as string },
      });

      if (!claim) return errorResponse(res, 'Claim not found', 404);
      if (claim.user_id !== req.user!.id && req.user!.role !== 'admin') {
        return errorResponse(res, 'Unauthorized to view this claim', 403);
      }

      return successResponse(res, claim, 'Claim fetched');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to fetch claim', 400);
    }
  }

  async approveClaim(req: AuthRequest, res: Response): Promise<any> {
    try {
      if (req.user!.role !== 'admin') return errorResponse(res, 'Admin only', 403);

      const claim = await freshGuaranteeService.approveClaim(req.user!.id, req.params.id as string);
      return successResponse(res, claim, 'Claim approved and refund processed');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to approve claim', 400);
    }
  }

  async rejectClaim(req: AuthRequest, res: Response): Promise<any> {
    try {
      if (req.user!.role !== 'admin') return errorResponse(res, 'Admin only', 403);

      const { reason } = req.body;
      if (!reason) return errorResponse(res, 'Rejection reason is required', 400);

      const claim = await freshGuaranteeService.rejectClaim(req.user!.id, req.params.id as string, reason);
      return successResponse(res, claim, 'Claim rejected');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to reject claim', 400);
    }
  }

  async getPresignedUrl(req: AuthRequest, res: Response): Promise<any> {
    try {
      const { filename, contentType } = req.query as { filename: string; contentType: string };
      
      if (!filename || !contentType) {
        return errorResponse(res, 'filename and contentType query params are required', 400);
      }

      const result = await generatePresignedUrl(filename, contentType);
      return successResponse(res, result, 'Presigned URL generated safely');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to generate url', 400);
    }
  }

  async getFreshRate(req: Request, res: Response): Promise<any> {
    try {
      const rate = await freshGuaranteeService.getCoopFreshRate(req.params.id as string);
      return successResponse(res, { fresh_rate: rate }, 'Fresh rate fetched efficiently');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Error executing query', 500);
    }
  }
}
