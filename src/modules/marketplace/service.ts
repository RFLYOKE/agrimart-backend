import prisma from '../../config/db';
import { CreateProductType, UpdateProductType, CreateOrderType, OrderFilterQueryType } from './schema';
import { Prisma } from '@prisma/client';

import { paymentService } from '../payment/service';

interface ProductFilters {
  category?: string;
  location?: string;
  search?: string;
  page?: string;
  limit?: string;
}

export class MarketplaceService {
  async getProducts(filters: ProductFilters, skip: number, take: number) {
    const whereClause: any = { is_active: true };

    if (filters.category) {
      whereClause.category = filters.category;
    }

    if (filters.search) {
      whereClause.name = { contains: filters.search, mode: 'insensitive' };
    }

    if (filters.location) {
      whereClause.cooperative = {
        location: { contains: filters.location, mode: 'insensitive' },
      };
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where: whereClause }),
      prisma.product.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          cooperative: {
            select: {
              name: true,
              fresh_rate: true,
              cert_status: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { total, products };
  }

  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        cooperative: {
          select: {
            id: true,
            name: true,
            fresh_rate: true,
            cert_status: true,
            location: true,
          },
        },
      },
    });

    if (!product) return null;

    const relatedProducts = await prisma.product.findMany({
      where: {
        category: product.category,
        id: { not: id },
        is_active: true,
      },
      take: 5,
      include: {
        cooperative: {
          select: { name: true },
        },
      },
    });

    return { ...product, relatedProducts };
  }

  async createProduct(userId: string, data: CreateProductType) {
    const coop = await prisma.cooperative.findUnique({
      where: { user_id: userId },
    });

    if (!coop) throw new Error('Not authorized: Cooperative not found');

    return prisma.product.create({
      data: {
        coop_id: coop.id,
        name: data.name,
        description: data.description,
        price_b2c: data.price_b2c,
        price_b2b: data.price_b2b,
        stock: data.stock,
        category: data.category || 'general',
        images: data.images,
      },
    });
  }

  async updateProduct(id: string, userId: string, data: UpdateProductType) {
    const coop = await prisma.cooperative.findUnique({
      where: { user_id: userId },
    });

    if (!coop) throw new Error('Not authorized: Cooperative not found');

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.coop_id !== coop.id) {
      throw new Error('Not authorized: Product not found or ownership mismatch');
    }

    return prisma.product.update({
      where: { id },
      data,
    });
  }

  async createOrder(buyerId: string, data: CreateOrderType) {
    return prisma.$transaction(async (tx) => {
      const buyer = await tx.user.findUnique({ where: { id: buyerId } });
      if (!buyer) throw new Error('Buyer not found');

      let totalPrice = 0;
      const isB2B = buyer.role === 'hotel_restoran' || buyer.role === 'eksportir';

      const orderItemsData = [];
      const midtransItemDetails = [];

      for (const item of data.items) {
        const product = await tx.product.findUnique({
          where: { id: item.product_id },
        });

        if (!product || !product.is_active) {
          throw new Error(`Product ${item.product_id} not available`);
        }

        if (product.stock < item.qty) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        const price = isB2B ? Number(product.price_b2b) : Number(product.price_b2c);
        totalPrice += price * item.qty;

        // Reduce stock
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.qty } },
        });

        orderItemsData.push({
          product_id: product.id,
          qty: item.qty,
          price_at_order: price,
        });

        midtransItemDetails.push({
          id: product.id,
          price: price,
          quantity: item.qty,
          name: product.name.substring(0, 50),
        });
      }

      const order = await (tx.order as any).create({
        data: {
          buyer_id: buyerId,
          total: totalPrice,
          payment_method: data.payment_method,
          address: data.address as any,
          status: 'pending',
          order_items: {
            create: orderItemsData,
          },
        },
        include: { order_items: true },
      });

      const customerDetails = {
        first_name: buyer.name,
        email: buyer.email,
        phone: buyer.phone || undefined,
      };

      const snapTransaction = await paymentService.createSnapTransaction(
        order.id,
        totalPrice,
        customerDetails,
        midtransItemDetails
      );

      return {
        order,
        snap_token: snapTransaction.token,
        redirect_url: snapTransaction.redirect_url,
      };
    });
  }

  async getMyOrders(userId: string, filters: OrderFilterQueryType, skip: number, take: number) {
    const whereClause: any = { buyer_id: userId };

    if (filters.status) {
      whereClause.status = filters.status as string;
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where: { ...whereClause } }),
      (prisma.order as any).findMany({
        where: whereClause,
        skip,
        take,
        include: {
          order_items: {
            include: {
              product: {
                select: { name: true, images: true },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { total, orders };
  }

  async updateOrderStatus(orderId: string, userId: string, status: string) {
    // Validate coop ownership of the order's items
    const coop = await prisma.cooperative.findUnique({
      where: { user_id: userId },
    });

    if (!coop) throw new Error('Not authorized: Cooperative not found');

    const order = await (prisma.order as any).findUnique({
      where: { id: orderId },
      include: {
        order_items: {
          include: { product: true },
        },
      },
    });

    if (!order) throw new Error('Order not found');

    // Assumes order items belong to the same cooperative or checks if any item belongs to the cooperative
    const hasOwnership = order.order_items.some((item: any) => item.product.coop_id === coop.id);
    if (!hasOwnership) {
      throw new Error('Not authorized: Order does not contain products from your cooperative');
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status } as any,
    });
  }
}
