import { Request, Response } from 'express';
import { MarketplaceService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import { paginate, paginationMeta } from '../../utils/pagination';
import { AuthRequest } from '../../middleware/auth';
import { Prisma } from '@prisma/client';

const service = new MarketplaceService();

export class MarketplaceController {
  async getProducts(req: Request, res: Response): Promise<any> {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const { skip, take } = paginate(page, limit);

      const filters = {
        category: req.query.category as string,
        location: req.query.location as string,
        search: req.query.search as string,
      };

      const { total, products } = await service.getProducts(filters, skip, take);
      const meta = paginationMeta(total, page, limit);

      return successResponse(res, { products, meta }, 'Products retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve products');
    }
  }

  async getProductById(req: Request, res: Response): Promise<any> {
    try {
      const id = req.params.id as string;
      const product = await service.getProductById(id);

      if (!product) {
        return errorResponse(res, 'Product not found', 404);
      }

      return successResponse(res, product, 'Product detail retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve product details');
    }
  }

  async createProduct(req: AuthRequest, res: Response): Promise<any> {
    try {
      const userId = req.user?.id as string;
      if (!userId) return errorResponse(res, 'Unauthorized', 401);

      const product = await service.createProduct(userId, req.body);
      return successResponse(res, product, 'Product created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create product', 400);
    }
  }

  async updateProduct(req: AuthRequest, res: Response): Promise<any> {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id as string;
      if (!userId) return errorResponse(res, 'Unauthorized', 401);

      const product = await service.updateProduct(id, userId, req.body);
      return successResponse(res, product, 'Product updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update product', 400);
    }
  }

  async createOrder(req: AuthRequest, res: Response): Promise<any> {
    try {
      const buyerId = req.user?.id as string;
      if (!buyerId) return errorResponse(res, 'Unauthorized', 401);

      const result = await service.createOrder(buyerId, req.body);
      return successResponse(res, result, 'Order created successfully', 201);
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to create order', 400);
    }
  }

  async getMyOrders(req: AuthRequest, res: Response): Promise<any> {
    try {
      const userId = req.user?.id as string;
      if (!userId) return errorResponse(res, 'Unauthorized', 401);

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 10;
      const { skip, take } = paginate(page, limit);

      const filters = {
        status: req.query.status as string | undefined,
      };

      const { total, orders } = await service.getMyOrders(userId, filters as any, skip, take);
      const meta = paginationMeta(total, page, limit);

      return successResponse(res, { orders, meta }, 'Orders retrieved successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve orders');
    }
  }

  async updateOrderStatus(req: AuthRequest, res: Response): Promise<any> {
    try {
      const id = req.params.id as string;
      const userId = req.user?.id as string;
      const { status } = req.body;

      if (!userId) return errorResponse(res, 'Unauthorized', 401);
      if (!status) {
        return errorResponse(res, 'Invalid status', 400);
      }

      const order = await service.updateOrderStatus(id, userId, status as string);
      return successResponse(res, order, 'Order status updated successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to update order status', 400);
    }
  }
}
