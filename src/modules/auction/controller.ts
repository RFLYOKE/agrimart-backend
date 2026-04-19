import { Request, Response } from 'express';
import { AuctionService } from './service';
import { successResponse, errorResponse } from '../../utils/response';

const service = new AuctionService();

export class AuctionController {
  async getAuctions(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getAuctions(req.query);
      successResponse(res, result, 'Auctions fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch auctions', 500);
    }
  }

  async getAuctionById(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getAuctionById(req.params.id as string);
      successResponse(res, result, 'Auction fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch auction', 404);
    }
  }

  async createAuction(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.createAuction(req.body);
      successResponse(res, result, 'Auction created successfully', 201);
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to create auction', 400);
    }
  }

  async placeBid(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.placeBid(req.params.id as string, req.body);
      successResponse(res, result, 'Bid placed successfully', 201);
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to place bid', 400);
    }
  }

  async updateAuction(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.updateAuction(req.params.id as string, req.body);
      successResponse(res, result, 'Auction updated successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to update auction', 400);
    }
  }

  async deleteAuction(req: Request, res: Response): Promise<void> {
    try {
      await service.deleteAuction(req.params.id as string);
      successResponse(res, null, 'Auction deleted successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to delete auction', 500);
    }
  }
}
