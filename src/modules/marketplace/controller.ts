import { Request, Response } from 'express';
import { MarketplaceService } from './service';
import { successResponse, errorResponse } from '../../utils/response';

const service = new MarketplaceService();

export class MarketplaceController {
  async getProducts(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getProducts(req.query);
      successResponse(res, result, 'Products fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch products', 500);
    }
  }

  async getProductById(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getProductById(req.params.id as string);
      successResponse(res, result, 'Product fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch product', 404);
    }
  }

  async getCategories(_req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getCategories();
      successResponse(res, result, 'Categories fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch categories', 500);
    }
  }

  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.createProduct(req.body);
      successResponse(res, result, 'Product created successfully', 201);
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to create product', 400);
    }
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.updateProduct(req.params.id as string, req.body);
      successResponse(res, result, 'Product updated successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to update product', 400);
    }
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      await service.deleteProduct(req.params.id as string);
      successResponse(res, null, 'Product deleted successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to delete product', 500);
    }
  }
}
