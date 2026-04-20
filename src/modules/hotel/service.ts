import prisma from '../../config/db';
import logger from '../../utils/logger';
import type {
  CreateBulkOrderInputType,
  CreateSubscriptionInputType,
  CancelSubscriptionInputType,
  InvoiceFilterQueryType,
  BulkOrderFilterQueryType,
  GenerateInvoiceInputType,
} from './schema';

// ============================================
// Hotel & Restoran Service — Business Logic
// ============================================

export class HotelService {

  // ──────────────────────────────────────────
  // a. Create Bulk Order (Order Massal)
  // ──────────────────────────────────────────

  async createBulkOrder(hotelId: string, data: CreateBulkOrderInputType) {
    // 1. Validasi semua produk exist dan stok cukup
    const productIds = data.items.map((i) => i.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, is_active: true },
      include: { cooperative: { select: { id: true, name: true } } },
    });

    if (products.length !== productIds.length) {
      const foundIds = products.map((p) => p.id);
      const missing = productIds.filter((id) => !foundIds.includes(id));
      throw new Error(`Produk tidak ditemukan atau tidak aktif: ${missing.join(', ')}`);
    }

    // 2. Validasi stok + hitung total dengan price_b2b
    let total = 0;
    const itemsWithPrice = data.items.map((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      if (product.stock < item.qty) {
        throw new Error(`Stok ${product.name} tidak cukup. Tersedia: ${product.stock}, diminta: ${item.qty}`);
      }
      const subtotal = Number(product.price_b2b) * item.qty;
      total += subtotal;
      return {
        product_id: item.product_id,
        product_name: product.name,
        coop_id: product.cooperative.id,
        coop_name: product.cooperative.name,
        qty: item.qty,
        price_b2b: Number(product.price_b2b),
        subtotal,
      };
    });

    // 3. Buat bulk_order record
    const bulkOrder = await prisma.bulkOrder.create({
      data: {
        hotel_id: hotelId,
        items: itemsWithPrice,
        total,
        delivery_date: data.delivery_date,
        delivery_address: data.delivery_address,
        note: data.note ?? null,
        status: 'pending',
      },
    });

    // 4. Kurangi stok produk
    for (const item of data.items) {
      await prisma.product.update({
        where: { id: item.product_id },
        data: { stock: { decrement: item.qty } },
      });
    }

    // 5. Group items by coop untuk notifikasi
    const coopGroups = new Map<string, string[]>();
    for (const item of itemsWithPrice) {
      if (!coopGroups.has(item.coop_id)) coopGroups.set(item.coop_id, []);
      coopGroups.get(item.coop_id)!.push(item.product_name);
    }

    // TODO: Kirim notifikasi FCM ke semua koperasi terlibat
    // for (const [coopId, productNames] of coopGroups) { ... }

    logger.info(`Bulk order ${bulkOrder.id} created by hotel ${hotelId}, total: ${total}`);

    return {
      id: bulkOrder.id,
      items: itemsWithPrice,
      total,
      deliveryDate: bulkOrder.delivery_date,
      status: bulkOrder.status,
      coopSummary: Array.from(coopGroups.entries()).map(([coopId, prods]) => ({
        coopId,
        coopName: itemsWithPrice.find((i) => i.coop_id === coopId)?.coop_name,
        products: prods,
        estimatedDelivery: bulkOrder.delivery_date,
      })),
    };
  }

  // ──────────────────────────────────────────
  // b. Create Subscription (Kontrak Langganan)
  // ──────────────────────────────────────────

  async createSubscription(hotelId: string, data: CreateSubscriptionInputType) {
    // 1. Validasi produk & koperasi exist
    const product = await prisma.product.findUnique({
      where: { id: data.product_id },
      include: { cooperative: true },
    });

    if (!product || !product.is_active) {
      throw new Error('Produk tidak ditemukan atau tidak aktif');
    }

    if (product.cooperative.id !== data.coop_id) {
      throw new Error('Produk tidak dimiliki oleh koperasi yang dipilih');
    }

    // 2. Lock harga B2B saat ini
    const priceLocked = Number(product.price_b2b);

    // 3. Buat subscription record
    const subscription = await prisma.subscription.create({
      data: {
        hotel_id: hotelId,
        coop_id: data.coop_id,
        product_id: data.product_id,
        qty_per_delivery: data.qty_per_delivery,
        frequency: data.frequency,
        delivery_day: data.delivery_day,
        start_date: data.start_date,
        end_date: data.end_date,
        price_locked: priceLocked,
        status: 'active',
      },
    });

    // 4. Hitung schedule berikutnya
    const nextDelivery = this.calculateNextDelivery(data.frequency, data.delivery_day, data.start_date);

    // 5. Estimasi biaya per bulan
    const deliveriesPerMonth = this.getDeliveriesPerMonth(data.frequency);
    const estimatedMonthly = priceLocked * data.qty_per_delivery * deliveriesPerMonth;

    logger.info(`Subscription ${subscription.id} created for hotel ${hotelId}, product ${product.name}`);

    return {
      id: subscription.id,
      product: { id: product.id, name: product.name, category: product.category },
      cooperative: { id: product.cooperative.id, name: product.cooperative.name },
      qtyPerDelivery: data.qty_per_delivery,
      frequency: data.frequency,
      deliveryDay: data.delivery_day,
      priceLocked,
      startDate: data.start_date,
      endDate: data.end_date,
      nextDelivery,
      estimatedMonthly,
      status: 'active',
    };
  }

  // ──────────────────────────────────────────
  // c. Pause Subscription
  // ──────────────────────────────────────────

  async pauseSubscription(hotelId: string, subscriptionId: string) {
    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, hotel_id: hotelId },
    });

    if (!sub) throw new Error('Subscription tidak ditemukan');
    if (sub.status !== 'active') throw new Error('Hanya subscription aktif yang bisa di-pause');

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'paused' },
    });

    logger.info(`Subscription ${subscriptionId} paused by hotel ${hotelId}`);
    return { id: updated.id, status: updated.status };
  }

  // ──────────────────────────────────────────
  // d. Cancel Subscription
  // ──────────────────────────────────────────

  async cancelSubscription(hotelId: string, subscriptionId: string, data: CancelSubscriptionInputType) {
    const sub = await prisma.subscription.findFirst({
      where: { id: subscriptionId, hotel_id: hotelId },
      include: { cooperative: { select: { user_id: true, name: true } } },
    });

    if (!sub) throw new Error('Subscription tidak ditemukan');
    if (sub.status === 'cancelled') throw new Error('Subscription sudah dibatalkan');

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'cancelled' },
    });

    // TODO: Kirim notifikasi FCM ke koperasi
    // await sendFcmNotification(sub.cooperative.user_id, { ... });

    logger.info(`Subscription ${subscriptionId} cancelled by hotel ${hotelId}. Reason: ${data.reason}`);
    return { id: updated.id, status: updated.status, coopName: sub.cooperative.name };
  }

  // ──────────────────────────────────────────
  // e. Process Subscription Orders (CRON)
  // ──────────────────────────────────────────

  async processSubscriptionOrders() {
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin, ...
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Query subscription aktif yang delivery_day = hari ini
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'active',
        delivery_day: currentDay,
        start_date: { lte: today },
        end_date: { gte: today },
      },
      include: {
        hotel: { select: { id: true, name: true } },
        cooperative: { select: { id: true, name: true } },
      },
    });

    // Filter berdasarkan frequency
    const due = subscriptions.filter((sub) => {
      return this.isDeliveryDue(sub.frequency, sub.delivery_day, sub.start_date, today);
    });

    logger.info(`[CRON Hotel] Processing ${due.length} subscription orders for day ${currentDay}`);

    for (const sub of due) {
      try {
        // 2. Buat order otomatis di marketplace
        const order = await prisma.order.create({
          data: {
            buyer_id: sub.hotel_id,
            total: Number(sub.price_locked) * sub.qty_per_delivery,
            status: 'pending',
            payment_method: 'subscription',
            address: {},
            order_items: {
              create: {
                product_id: sub.product_id,
                qty: sub.qty_per_delivery,
                price_at_order: sub.price_locked,
              },
            },
          },
        });

        logger.info(`[CRON Hotel] Auto-order ${order.id} created for subscription ${sub.id}`);

        // TODO: Send FCM notifications to hotel & cooperative
      } catch (err) {
        logger.error(`[CRON Hotel] Failed to process subscription ${sub.id}:`, err);
      }
    }

    return { processed: due.length };
  }

  // ──────────────────────────────────────────
  // f. Generate Monthly Invoice
  // ──────────────────────────────────────────

  async generateMonthlyInvoice(hotelId: string, data: GenerateInvoiceInputType) {
    // 1. Kumpulkan semua order hotel dalam periode
    const orders = await prisma.order.findMany({
      where: {
        buyer_id: hotelId,
        created_at: {
          gte: data.period_start,
          lte: data.period_end,
        },
        status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
      },
      select: {
        id: true,
        total: true,
        created_at: true,
        order_items: {
          select: {
            qty: true,
            price_at_order: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    if (orders.length === 0) {
      throw new Error('Tidak ada order dalam periode yang dipilih');
    }

    // 2. Hitung subtotal + PPN 11%
    const subtotal = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const tax = Math.round(subtotal * 0.11);
    const total = subtotal + tax;

    // 3. Due date = 30 hari dari sekarang
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // 4. Buat invoice record
    const invoice = await prisma.invoice.create({
      data: {
        hotel_id: hotelId,
        orders: orders.map((o) => ({
          orderId: o.id,
          total: Number(o.total),
          date: o.created_at,
          items: o.order_items.map((oi) => ({
            productName: oi.product.name,
            qty: oi.qty,
            price: Number(oi.price_at_order),
          })),
        })),
        period_start: data.period_start,
        period_end: data.period_end,
        subtotal,
        tax,
        total,
        status: 'sent',
        due_date: dueDate,
        pdf_url: null, // TODO: Generate PDF via pdfkit, upload to S3
      },
    });

    // TODO: Generate PDF with pdfkit
    // TODO: Upload PDF to S3
    // TODO: Send email notification via nodemailer

    logger.info(`Invoice ${invoice.id} generated for hotel ${hotelId}, total: ${total}`);

    return {
      id: invoice.id,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      orderCount: orders.length,
      subtotal,
      tax,
      total,
      dueDate,
      status: invoice.status,
      pdfUrl: invoice.pdf_url,
    };
  }

  // ──────────────────────────────────────────
  // g. Get My Invoices
  // ──────────────────────────────────────────

  async getMyInvoices(hotelId: string, filters: InvoiceFilterQueryType) {
    const where: any = { hotel_id: hotelId };
    if (filters.status) where.status = filters.status;
    if (filters.period_start || filters.period_end) {
      where.period_start = {};
      if (filters.period_start) where.period_start.gte = filters.period_start;
      if (filters.period_end) where.period_end = { lte: filters.period_end };
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        subtotal: Number(inv.subtotal),
        tax: Number(inv.tax),
        total: Number(inv.total),
        status: inv.status,
        dueDate: inv.due_date,
        pdfUrl: inv.pdf_url,
        createdAt: inv.created_at,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ──────────────────────────────────────────
  // h. Get My Subscriptions
  // ──────────────────────────────────────────

  async getMySubscriptions(hotelId: string) {
    const subs = await prisma.subscription.findMany({
      where: { hotel_id: hotelId },
      orderBy: { created_at: 'desc' },
      include: {
        cooperative: { select: { id: true, name: true } },
      },
    });

    // Enrich dengan product name
    const productIds = subs.map((s) => s.product_id);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, category: true, images: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return subs.map((sub) => {
      const product = productMap.get(sub.product_id);
      const nextDelivery = sub.status === 'active'
        ? this.calculateNextDelivery(sub.frequency, sub.delivery_day, new Date())
        : null;

      return {
        id: sub.id,
        product: product ? {
          id: product.id,
          name: product.name,
          category: product.category,
          image: product.images[0] ?? null,
        } : null,
        cooperative: sub.cooperative,
        qtyPerDelivery: sub.qty_per_delivery,
        frequency: sub.frequency,
        deliveryDay: sub.delivery_day,
        priceLocked: Number(sub.price_locked),
        startDate: sub.start_date,
        endDate: sub.end_date,
        status: sub.status,
        nextDelivery,
      };
    });
  }

  // ──────────────────────────────────────────
  // i. Get Bulk Order History
  // ──────────────────────────────────────────

  async getBulkOrderHistory(hotelId: string, filters: BulkOrderFilterQueryType) {
    const where: any = { hotel_id: hotelId };
    if (filters.status) where.status = filters.status;

    const [orders, total] = await Promise.all([
      prisma.bulkOrder.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.bulkOrder.count({ where }),
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.id,
        items: o.items,
        total: Number(o.total),
        deliveryDate: o.delivery_date,
        deliveryAddress: o.delivery_address,
        note: o.note,
        status: o.status,
        createdAt: o.created_at,
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  // ──────────────────────────────────────────
  // Helper Methods
  // ──────────────────────────────────────────

  private calculateNextDelivery(frequency: string, deliveryDay: number, fromDate: Date): Date {
    const next = new Date(fromDate);
    const currentDay = next.getDay();

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        const daysUntil = (deliveryDay - currentDay + 7) % 7 || 7;
        next.setDate(next.getDate() + daysUntil);
        break;
      case 'biweekly':
        const daysUntilBi = (deliveryDay - currentDay + 7) % 7 || 14;
        next.setDate(next.getDate() + daysUntilBi);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        next.setDate(deliveryDay + 1); // delivery_day as day of month (0-indexed)
        break;
    }

    return next;
  }

  private getDeliveriesPerMonth(frequency: string): number {
    switch (frequency) {
      case 'daily': return 30;
      case 'weekly': return 4;
      case 'biweekly': return 2;
      case 'monthly': return 1;
      default: return 1;
    }
  }

  private isDeliveryDue(frequency: string, deliveryDay: number, startDate: Date, today: Date): boolean {
    const diffMs = today.getTime() - new Date(startDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    switch (frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return today.getDay() === deliveryDay;
      case 'biweekly':
        return today.getDay() === deliveryDay && Math.floor(diffDays / 7) % 2 === 0;
      case 'monthly':
        return today.getDate() === deliveryDay + 1;
      default:
        return false;
    }
  }
}

export default new HotelService();
