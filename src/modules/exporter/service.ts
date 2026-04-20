import prisma from '../../config/db';
import logger from '../../utils/logger';
import type {
  CreateRFQInputType,
  SubmitQuoteInputType,
  AwardQuoteInputType,
  UploadExportDocInputType,
} from './schema';

// ============================================
// Exporter Service — Business Logic
// ============================================

export class ExporterService {

  // ──────────────────────────────────────────
  // 1. RFQ Management
  // ──────────────────────────────────────────

  async createRFQ(exporterId: string, data: CreateRFQInputType) {
    const rfq = await prisma.rfqRequest.create({
      data: {
        exporter_id: exporterId,
        title: data.title,
        commodity: data.commodity,
        category: data.category,
        quantity: data.quantity,
        unit: data.unit,
        target_price_per_unit: data.target_price_per_unit,
        currency: data.currency,
        delivery_port: data.delivery_port,
        required_certifications: data.required_certifications,
        delivery_deadline: data.delivery_deadline,
        description: data.description ?? null,
        status: 'open',
      },
    });

    // TODO: Send FCM broadcast to Koperasi matching the category

    logger.info(`RFQ ${rfq.id} created by exporter ${exporterId}`);
    return rfq;
  }

  async getOpenRFQs(filters: any) {
    const where: any = { status: 'open' };
    if (filters.category) where.category = filters.category;
    if (filters.commodity) where.commodity = { contains: filters.commodity, mode: 'insensitive' };

    const [rfqs, total] = await Promise.all([
      prisma.rfqRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        include: {
          exporter: { select: { id: true, name: true, phone: true } },
          _count: { select: { quotes: true } },
        },
      }),
      prisma.rfqRequest.count({ where }),
    ]);

    return {
      rfqs: rfqs.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        target_price_per_unit: Number(r.target_price_per_unit),
      })),
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getMyRFQs(exporterId: string) {
    const rfqs = await prisma.rfqRequest.findMany({
      where: { exporter_id: exporterId },
      orderBy: { created_at: 'desc' },
      include: {
        _count: { select: { quotes: true } },
      },
    });

    return rfqs.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      target_price_per_unit: Number(r.target_price_per_unit),
    }));
  }

  async getRFQDetail(rfqId: string, userId: string, role: string) {
    const rfq = await prisma.rfqRequest.findUnique({
      where: { id: rfqId },
      include: { exporter: { select: { name: true, phone: true } } },
    });

    if (!rfq) throw new Error('RFQ tidak ditemukan');

    // Jika Eksportir -> tampilkan semua quote untuk RFQ ini
    // Jika Koperasi -> tampilkan hanya quote milik sendiri untuk RFQ ini
    let quotes: any[] = [];
    if (role === 'eksportir') {
      if (rfq.exporter_id !== userId) throw new Error('Anda tidak memiliki akses ke RFQ ini');
      quotes = await prisma.rfqQuote.findMany({
        where: { rfq_id: rfqId },
        orderBy: { created_at: 'desc' },
        include: { cooperative: { select: { id: true, name: true, description: true } } },
      });
    } else if (role === 'koperasi') {
      const myCoop = await prisma.cooperative.findUnique({ where: { user_id: userId } });
      if (myCoop) {
        quotes = await prisma.rfqQuote.findMany({
          where: { rfq_id: rfqId, coop_id: myCoop.id },
          orderBy: { created_at: 'desc' },
          include: { cooperative: { select: { id: true, name: true } } },
        });
      }
    }

    return {
      rfq: {
        ...rfq,
        quantity: Number(rfq.quantity),
        target_price_per_unit: Number(rfq.target_price_per_unit),
      },
      quotes: quotes.map((q) => ({
        ...q,
        price_per_unit: Number(q.price_per_unit),
        total_price: Number(q.total_price),
        available_quantity: Number(q.available_quantity),
      })),
    };
  }

  // ──────────────────────────────────────────
  // 2. Quoting Management
  // ──────────────────────────────────────────

  async submitQuote(userId: string, data: SubmitQuoteInputType) {
    const rfq = await prisma.rfqRequest.findUnique({ where: { id: data.rfq_id } });
    if (!rfq) throw new Error('RFQ tidak ditemukan');
    if (rfq.status !== 'open') throw new Error('RFQ sudah ditutup / tidak menerima penawaran lagi');

    const koperasi = await prisma.cooperative.findUnique({ where: { user_id: userId } });
    if (!koperasi) throw new Error('Profil koperasi tidak ditemukan');

    // Cek duplicate quote
    const existing = await prisma.rfqQuote.findFirst({
      where: { rfq_id: data.rfq_id, coop_id: koperasi.id },
    });
    if (existing) throw new Error('Anda sudah mengirim penawaran untuk RFQ ini');

    const total_price = data.price_per_unit * data.available_quantity;

    const quote = await prisma.rfqQuote.create({
      data: {
        rfq_id: data.rfq_id,
        coop_id: koperasi.id,
        price_per_unit: data.price_per_unit,
        total_price,
        available_quantity: data.available_quantity,
        delivery_date: data.delivery_date,
        notes: data.notes ?? null,
        certifications_available: data.certifications_available,
        status: 'pending',
      },
    });

    // TODO: Send FCM to Exporter that a new quote arrived

    logger.info(`Quote ${quote.id} submitted for RFQ ${rfq.id} by Coop ${koperasi.id}`);
    return quote;
  }

  async awardQuote(exporterId: string, data: AwardQuoteInputType) {
    const rfq = await prisma.rfqRequest.findUnique({ where: { id: data.rfq_id } });
    if (!rfq) throw new Error('RFQ tidak ditemukan');
    if (rfq.exporter_id !== exporterId) throw new Error('Unauthorized');
    if (rfq.status !== 'open') throw new Error('RFQ sudah tidak open');

    const quote = await prisma.rfqQuote.findUnique({
      where: { id: data.quote_id },
      include: { cooperative: true },
    });
    if (!quote || quote.rfq_id !== data.rfq_id) throw new Error('Quote tidak valid');

    // Transaksi: Accept 1, Reject Others, Update RFQ
    await prisma.$transaction(async (tx) => {
      // 1. Terima quote terpilih
      await tx.rfqQuote.update({
        where: { id: quote.id },
        data: { status: 'accepted' },
      });

      // 2. Tolak sisa quote
      await tx.rfqQuote.updateMany({
        where: { rfq_id: rfq.id, id: { not: quote.id } },
        data: { status: 'rejected' },
      });

      // 3. Update status RFQ
      await tx.rfqRequest.update({
        where: { id: rfq.id },
        data: { status: 'awarded' },
      });

      // 4. (Opsional) Buat draft Order Massal
      // Note: Di implementasi real, auto-create order bisa terjadi di sini.
    });

    // TODO: Notifikasi koperasi pemenang dan koperasi yg kalah

    logger.info(`Quote ${quote.id} awarded for RFQ ${rfq.id}`);
    return { success: true, message: 'Penawaran berhasil diterima' };
  }

  // ──────────────────────────────────────────
  // 3. Document Management
  // ──────────────────────────────────────────

  async uploadExportDoc(exporterId: string, data: UploadExportDocInputType) {
    const doc = await prisma.exportDocument.create({
      data: {
        exporter_id: exporterId,
        order_id: data.order_id ?? null,
        rfq_id: data.rfq_id ?? null,
        doc_type: data.doc_type,
        doc_url: data.doc_url,
        issued_by: data.issued_by,
        issue_date: data.issue_date,
        expiry_date: data.expiry_date,
        status: 'submitted', // Asumsi draft->submitted otomatis
      },
    });

    logger.info(`ExportDoc ${doc.id} uploaded by Exporter ${exporterId}`);
    return doc;
  }

  async getMyExportDocs(exporterId: string, filters: any) {
    const where: any = { exporter_id: exporterId };
    if (filters.doc_type) where.doc_type = filters.doc_type;
    if (filters.status) where.status = filters.status;

    const [docs, total] = await Promise.all([
      prisma.exportDocument.findMany({
        where,
        orderBy: { issue_date: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.exportDocument.count({ where }),
    ]);

    return { docs, pagination: { page: filters.page, limit: filters.limit, total } };
  }

  // Dipanggil oleh CRON
  async checkExpiringDocs() {
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const now = new Date();

    const expiring = await prisma.exportDocument.findMany({
      where: {
        status: { in: ['approved', 'submitted'] },
        expiry_date: { lte: in30Days, gte: now },
      },
      include: { exporter: { select: { id: true, name: true } } },
    });

    // Handle dokumen yg sudah benar2 expired
    await prisma.exportDocument.updateMany({
      where: { status: { not: 'expired' }, expiry_date: { lt: now } },
      data: { status: 'expired' },
    });

    // Filter yg butuh notifikasi
    for (const doc of expiring) {
      // TODO: send push notification to doc.exporter.id
    }

    return { processedExpiringWarning: expiring.length };
  }

  // ──────────────────────────────────────────
  // 4. Currency Conversion
  // ──────────────────────────────────────────

  async updateCurrencyRates() {
    try {
      // MOCK: In production, fetch from https://api.exchangerate-api.com/v4/latest/IDR
      const mockRates = [
        { from: 'IDR', to: 'USD', rate: 0.000063 },
        { from: 'IDR', to: 'EUR', rate: 0.000058 },
        { from: 'IDR', to: 'JPY', rate: 0.0095 },
        { from: 'IDR', to: 'SGD', rate: 0.000085 },
        { from: 'IDR', to: 'AUD', rate: 0.000096 },
        { from: 'IDR', to: 'IDR', rate: 1.0 },
      ];

      for (const r of mockRates) {
        // Upsert style
        const existing = await prisma.currencyRate.findFirst({
          where: { from_currency: r.from, to_currency: r.to },
        });

        if (existing) {
          await prisma.currencyRate.update({
            where: { id: existing.id },
            data: { rate: r.rate },
          });
        } else {
          await prisma.currencyRate.create({
            data: { from_currency: r.from, to_currency: r.to, rate: r.rate },
          });
        }
      }

      logger.info(`[Currency] Updated ${mockRates.length} exchange rates.`);
    } catch (error) {
      logger.error('Failed to update currency rates', error);
    }
  }

  async fetchLatestRates() {
    const rates = await prisma.currencyRate.findMany();
    // Return key-value pair based on IDR
    const rateMap: Record<string, number> = {};
    for (const r of rates) {
      rateMap[r.to_currency] = Number(r.rate);
    }
    return rateMap;
  }
}

export default new ExporterService();
