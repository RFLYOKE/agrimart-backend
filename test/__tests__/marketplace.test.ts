import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/db';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock DB
jest.mock('../../src/config/db', () => ({
  prisma: {
    product: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(prisma)),
  },
}));

// Mock Auth Middleware
jest.mock('../../src/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { id: 'user_1', role: 'BUYER' };
    next();
  },
  authorizeRole: () => (req: any, res: any, next: any) => next(),
}));

// Mock Midtrans
jest.mock('midtrans-client', () => {
  return {
    Snap: jest.fn<any>().mockImplementation(() => ({
      createTransaction: jest.fn<any>().mockResolvedValue({
        token: 'mock-snap-token',
        redirect_url: 'https://mock-midtrans.url',
      }),
    })),
    CoreApi: jest.fn(),
  };
});

describe('Marketplace Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/marketplace/products', () => {
    it('Harus return list produk dengan pagination', async () => {
      const mockProducts = [
        { id: '1', name: 'Beras Premium', price: 10000 },
        { id: '2', name: 'Jagung', price: 5000 },
      ];

      (prisma.product.findMany as jest.Mock<any>).mockResolvedValue(mockProducts);
      (prisma.product.count as jest.Mock<any>).mockResolvedValue(2);

      const res = await request(app).get('/api/marketplace/products?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.products).toEqual(mockProducts);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination.page).toBe(1);
    });
  });

  describe('POST /api/marketplace/orders', () => {
    it('Berhasil buat order jika stok cukup dan buat token midtrans', async () => {
      // Mock findUnique to return a product with sufficient stock
      (prisma.product.findUnique as jest.Mock<any>).mockResolvedValue({
        id: 'prod_1',
        name: 'Beras Premium',
        price: 15000,
        stock: 10,
        farmerId: 'farmer_1',
      });

      // Mock order creation inside transaction
      (prisma.order.create as jest.Mock<any>).mockResolvedValue({
        id: 'mock-order-id',
        buyerId: 'user_1',
        totalPrice: 30000,
      });

      const res = await request(app)
        .post('/api/marketplace/orders')
        .send({
          items: [{ productId: 'prod_1', quantity: 2 }],
          shippingAddress: 'Alamat Test',
        });

      // Assert stock transaction logic in actual implementation would decrease stock
      // And snap transaction is created
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.paymentToken).toBe('mock-snap-token');
      expect(res.body.data.paymentUrl).toBe('https://mock-midtrans.url');
    });

    it('Gagal jika stok tidak cukup (400)', async () => {
      // Product exist but stock is only 1
      (prisma.product.findUnique as jest.Mock<any>).mockResolvedValue({
        id: 'prod_1',
        name: 'Beras Premium',
        price: 15000,
        stock: 1,
      });

      const res = await request(app)
        .post('/api/marketplace/orders')
        .send({
          items: [{ productId: 'prod_1', quantity: 5 }],
          shippingAddress: 'Alamat Test',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/stok tidak cukup|insufficient stock/i);
    });
  });
});
