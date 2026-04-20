import prisma from '../../config/db';
import { redisHelper } from '../../config/redis';
import logger from '../../utils/logger';
import type {
  UserFilterQueryType,
  AnalyticsQueryType,
  ClaimFilterQueryType,
  VerifyCoopInputType,
  UpdateUserStatusInputType,
} from './schema';

// ============================================
// Admin Service — Business Logic Layer
// ============================================

export class AdminService {

  // ──────────────────────────────────────────
  // a. Platform Overview Stats
  // ──────────────────────────────────────────

  /**
   * Mengambil semua statistik platform dalam satu panggilan.
   * Digunakan untuk Dashboard Overview (MetricCards).
   */
  async getPlatformStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Jalankan semua query secara paralel untuk performa maksimal
    const [
      usersByRole,
      totalUsersCount,
      ordersToday,
      ordersWeek,
      ordersMonth,
      totalRevenue,
      coopVerified,
      coopPending,
      pendingClaims,
      activeAuctions,
    ] = await Promise.all([
      // 1. Total user per role (GROUP BY role)
      prisma.user.groupBy({
        by: ['role'],
        _count: { id: true },
      }),

      // 2. Total users
      prisma.user.count(),

      // 3. Transaksi hari ini
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total: true },
        where: { created_at: { gte: startOfDay } },
      }),

      // 4. Transaksi minggu ini
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total: true },
        where: { created_at: { gte: startOfWeek } },
      }),

      // 5. Transaksi bulan ini
      prisma.order.aggregate({
        _count: { id: true },
        _sum: { total: true },
        where: { created_at: { gte: startOfMonth } },
      }),

      // 6. Total revenue (orders yang sudah delivered)
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: 'delivered' },
      }),

      // 7. Koperasi terverifikasi
      prisma.cooperative.count({
        where: { cert_status: 'verified' },
      }),

      // 8. Koperasi pending
      prisma.cooperative.count({
        where: { cert_status: 'pending' },
      }),

      // 9. Klaim Fresh Guarantee pending
      prisma.claim.count({
        where: { status: 'pending' },
      }),

      // 10. Auction aktif saat ini
      prisma.auction.count({
        where: { status: 'active' },
      }),
    ]);

    // Format user per role menjadi object
    const usersBreakdown: Record<string, number> = {};
    usersByRole.forEach((item) => {
      usersBreakdown[item.role] = item._count.id;
    });

    return {
      users: {
        total: totalUsersCount,
        breakdown: usersBreakdown,
      },
      transactions: {
        today: {
          count: ordersToday._count.id,
          total: Number(ordersToday._sum.total ?? 0),
        },
        thisWeek: {
          count: ordersWeek._count.id,
          total: Number(ordersWeek._sum.total ?? 0),
        },
        thisMonth: {
          count: ordersMonth._count.id,
          total: Number(ordersMonth._sum.total ?? 0),
        },
      },
      revenue: {
        total: Number(totalRevenue._sum.total ?? 0),
      },
      cooperatives: {
        verified: coopVerified,
        pending: coopPending,
      },
      pendingClaims,
      activeAuctions,
    };
  }

  // ──────────────────────────────────────────
  // b. Get All Users (filterable + paginated)
  // ──────────────────────────────────────────

  async getAllUsers(filters: UserFilterQueryType) {
    const { role, status, search, page, limit } = filters;

    // Build where clause secara dinamis
    const where: any = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
          created_at: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Format response
    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      joinDate: user.created_at,
      transactionCount: user._count.orders,
    }));

    return {
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ──────────────────────────────────────────
  // c. Get User Detail
  // ──────────────────────────────────────────

  async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        orders: {
          take: 10,
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            total: true,
            status: true,
            payment_method: true,
            created_at: true,
            order_items: {
              select: {
                qty: true,
                price_at_order: true,
                product: { select: { name: true } },
              },
            },
          },
        },
        cooperative: {
          include: {
            products: {
              where: { is_active: true },
              select: { id: true, name: true, price_b2c: true, stock: true, category: true },
            },
            certifications: {
              select: { type: true, status: true, valid_until: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User tidak ditemukan');
    }

    // Jika koperasi: hitung total penjualan
    let coopStats = null;
    if (user.cooperative) {
      const salesAggregate = await prisma.orderItem.aggregate({
        _sum: { price_at_order: true },
        _count: { id: true },
        where: {
          product: { coop_id: user.cooperative.id },
        },
      });

      coopStats = {
        freshRate: user.cooperative.fresh_rate,
        totalSales: Number(salesAggregate._sum.price_at_order ?? 0),
        totalOrders: salesAggregate._count.id,
        activeProducts: user.cooperative.products.length,
        certifications: user.cooperative.certifications,
      };
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      joinDate: user.created_at,
      recentOrders: user.orders.map((o) => ({
        ...o,
        total: Number(o.total),
      })),
      cooperative: user.cooperative ? {
        id: user.cooperative.id,
        name: user.cooperative.name,
        sector: user.cooperative.sector,
        location: user.cooperative.location,
        certStatus: user.cooperative.cert_status,
        ...coopStats,
      } : null,
    };
  }

  // ──────────────────────────────────────────
  // d. Update User Status (suspend/ban/activate)
  // ──────────────────────────────────────────

  async updateUserStatus(adminId: string, userId: string, data: UpdateUserStatusInputType) {
    // Cegah admin men-suspend dirinya sendiri
    if (adminId === userId) {
      throw new Error('Admin tidak dapat mengubah status dirinya sendiri');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User tidak ditemukan');

    // Update status
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: data.status },
    });

    // Jika suspended/banned: invalidasi semua refresh token di Redis
    if (data.status === 'suspended' || data.status === 'banned') {
      try {
        // Set blacklist flag di Redis agar semua token di-reject
        await redisHelper.set(`user_blacklist:${userId}`, 'true', 30 * 24 * 60 * 60); // 30 hari
        logger.info(`Semua token untuk user ${userId} telah diblacklist`);
      } catch (err) {
        logger.error(`Gagal blacklist token user ${userId}:`, err);
      }
    } else if (data.status === 'active') {
      // Hapus blacklist jika diaktifkan kembali
      try {
        await redisHelper.del(`user_blacklist:${userId}`);
      } catch (err) {
        logger.error(`Gagal menghapus blacklist user ${userId}:`, err);
      }
    }

    // Log aksi admin ke admin_logs
    await prisma.adminLog.create({
      data: {
        admin_id: adminId,
        action: `update_user_status_to_${data.status}`,
        target_type: 'user',
        target_id: userId,
        detail: {
          previousStatus: user.status,
          newStatus: data.status,
          reason: data.reason,
        },
      },
    });

    // TODO: Kirim notifikasi FCM ke user terkait
    // await sendFcmNotification(userId, { title: '...', body: '...' });

    logger.info(`Admin ${adminId} mengubah status user ${userId} ke ${data.status}`);

    return {
      id: updated.id,
      name: updated.name,
      status: updated.status,
    };
  }

  // ──────────────────────────────────────────
  // e. Get Pending Cooperatives
  // ──────────────────────────────────────────

  async getPendingCooperatives() {
    const coops = await prisma.cooperative.findMany({
      where: { cert_status: 'pending' },
      orderBy: { user: { created_at: 'asc' } },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, created_at: true },
        },
        certifications: {
          select: { id: true, type: true, doc_url: true, status: true },
        },
      },
    });

    return coops.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      location: c.location,
      description: c.description,
      certStatus: c.cert_status,
      user: c.user,
      documents: c.certifications,
    }));
  }

  // ──────────────────────────────────────────
  // f. Verify Cooperative (approve/reject)
  // ──────────────────────────────────────────

  async verifyCooperative(adminId: string, data: VerifyCoopInputType) {
    const coop = await prisma.cooperative.findUnique({
      where: { id: data.coop_id },
      include: { user: { select: { id: true, name: true } } },
    });

    if (!coop) throw new Error('Koperasi tidak ditemukan');
    if (coop.cert_status !== 'pending') {
      throw new Error(`Koperasi sudah di-${coop.cert_status}, tidak bisa diubah lagi`);
    }

    if (data.action === 'approve') {
      await prisma.cooperative.update({
        where: { id: data.coop_id },
        data: {
          cert_status: 'verified',
          verified_at: new Date(),
        },
      });
    } else {
      await prisma.cooperative.update({
        where: { id: data.coop_id },
        data: {
          cert_status: 'rejected',
          // Simpan reason di description sebagai fallback (atau bisa ditambah kolom baru)
        },
      });
    }

    // Log aksi admin
    await prisma.adminLog.create({
      data: {
        admin_id: adminId,
        action: `verify_cooperative_${data.action}`,
        target_type: 'cooperative',
        target_id: data.coop_id,
        detail: {
          coopName: coop.name,
          action: data.action,
          reason: data.reason ?? null,
        },
      },
    });

    // TODO: Kirim notifikasi FCM ke user koperasi
    // await sendFcmNotification(coop.user.id, { ... });

    logger.info(`Admin ${adminId} ${data.action} koperasi ${coop.name} (${coop.id})`);

    return {
      coopId: coop.id,
      coopName: coop.name,
      action: data.action,
    };
  }

  // ──────────────────────────────────────────
  // g. Get All Claims (Fresh Guarantee)
  // ──────────────────────────────────────────

  async getAllClaims(filters: ClaimFilterQueryType) {
    const { status, page, limit } = filters;

    const where: any = {};
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.claim.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: {
            select: {
              id: true,
              total: true,
              status: true,
              created_at: true,
              order_items: {
                select: {
                  qty: true,
                  product: { select: { name: true, images: true } },
                },
              },
            },
          },
        },
      }),
      prisma.claim.count({ where }),
    ]);

    return {
      claims: claims.map((c) => ({
        id: c.id,
        issueType: c.issue_type,
        description: c.description,
        photoUrls: c.photo_urls,
        refundType: c.refund_type,
        refundAmount: Number(c.refund_amount),
        status: c.status,
        rejectReason: c.reject_reason,
        createdAt: c.created_at,
        buyer: c.user,
        order: {
          id: c.order.id,
          total: Number(c.order.total),
          status: c.order.status,
          items: c.order.order_items.map((item) => ({
            productName: item.product.name,
            qty: item.qty,
            productImage: item.product.images[0] ?? null,
          })),
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ──────────────────────────────────────────
  // h. Platform Analytics (Charts Data)
  // ──────────────────────────────────────────

  async getPlatformAnalytics(query: AnalyticsQueryType) {
    const { period } = query;

    // Tentukan grouping dan range berdasarkan period
    const now = new Date();
    let startDate: Date;
    let dateGrouping: string;

    switch (period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        dateGrouping = 'day';
        break;
      case 'weekly':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        dateGrouping = 'week';
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        dateGrouping = 'month';
        break;
    }

    // Revenue per period (raw SQL untuk date_trunc)
    const revenueData = await prisma.$queryRawUnsafe<Array<{ period: Date; revenue: number; count: number }>>(
      `SELECT date_trunc('${dateGrouping}', created_at) as period, 
              SUM(total::numeric) as revenue, 
              COUNT(*)::int as count
       FROM "Order" 
       WHERE created_at >= $1 AND status IN ('delivered', 'paid', 'processing', 'shipped')
       GROUP BY period 
       ORDER BY period ASC`,
      startDate
    );

    // Top 10 produk terlaris (by quantity sold)
    const topProducts = await prisma.orderItem.groupBy({
      by: ['product_id'],
      _sum: { qty: true },
      _count: { id: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 10,
    });

    // Enrich top products with product name
    const productIds = topProducts.map((p) => p.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const topProductsFormatted = topProducts.map((p) => ({
      productId: p.product_id,
      productName: productMap.get(p.product_id)?.name ?? 'Unknown',
      category: productMap.get(p.product_id)?.category ?? 'Unknown',
      totalSold: p._sum.qty ?? 0,
      orderCount: p._count.id,
    }));

    // Top 10 koperasi by revenue
    const topCoops = await prisma.$queryRawUnsafe<Array<{ coop_id: string; coop_name: string; revenue: number; order_count: number }>>(
      `SELECT c.id as coop_id, c.name as coop_name,
              SUM(oi.price_at_order::numeric * oi.qty) as revenue,
              COUNT(DISTINCT oi.order_id)::int as order_count
       FROM "OrderItem" oi
       JOIN "Product" p ON oi.product_id = p.id
       JOIN "Cooperative" c ON p.coop_id = c.id
       GROUP BY c.id, c.name
       ORDER BY revenue DESC
       LIMIT 10`
    );

    // Distribusi order per metode pembayaran
    const paymentDistribution = await prisma.order.groupBy({
      by: ['payment_method'],
      _count: { id: true },
      _sum: { total: true },
    });

    // Distribusi user per role (untuk pie chart)
    const userDistribution = await prisma.user.groupBy({
      by: ['role'],
      _count: { id: true },
    });

    return {
      revenue: revenueData.map((r) => ({
        period: r.period,
        revenue: Number(r.revenue),
        orderCount: Number(r.count),
      })),
      topProducts: topProductsFormatted,
      topCooperatives: topCoops.map((c) => ({
        coopId: c.coop_id,
        coopName: c.coop_name,
        revenue: Number(c.revenue),
        orderCount: c.order_count,
      })),
      paymentMethods: paymentDistribution.map((p) => ({
        method: p.payment_method,
        count: p._count.id,
        total: Number(p._sum.total ?? 0),
      })),
      userRoles: userDistribution.map((u) => ({
        role: u.role,
        count: u._count.id,
      })),
    };
  }
}

export default new AdminService();
