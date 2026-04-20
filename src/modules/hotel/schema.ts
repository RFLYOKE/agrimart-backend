import { z } from 'zod';

// ============================================
// Hotel & Restoran — Zod Schemas
// ============================================

/**
 * Input untuk membuat Bulk Order (order massal)
 */
export const CreateBulkOrderInput = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    qty: z.number().int().min(1, 'Minimal quantity 1'),
  })).min(1, 'Minimal 1 item dalam order'),
  delivery_date: z.coerce.date().refine(
    (d) => d > new Date(),
    'Tanggal pengiriman harus di masa depan'
  ),
  delivery_address: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    province: z.string().min(1),
    postal_code: z.string().min(1),
    recipient_name: z.string().min(1),
    recipient_phone: z.string().min(1),
  }),
  note: z.string().optional(),
});

/**
 * Input untuk membuat kontrak langganan
 */
export const CreateSubscriptionInput = z.object({
  coop_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_per_delivery: z.number().int().min(1, 'Minimal 1 unit per pengiriman'),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']),
  delivery_day: z.number().int().min(0).max(6, 'Hari pengiriman 0-6 (Minggu-Sabtu)'),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
}).refine(
  (data) => data.end_date > data.start_date,
  { message: 'Tanggal berakhir harus setelah tanggal mulai', path: ['end_date'] }
);

/**
 * Input untuk cancel subscription
 */
export const CancelSubscriptionInput = z.object({
  reason: z.string().min(5, 'Alasan minimal 5 karakter'),
});

/**
 * Filter untuk list invoices
 */
export const InvoiceFilterQuery = z.object({
  status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional(),
  period_start: z.coerce.date().optional(),
  period_end: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Filter untuk bulk order history
 */
export const BulkOrderFilterQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'processing', 'delivered']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/**
 * Input untuk generate invoice
 */
export const GenerateInvoiceInput = z.object({
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
}).refine(
  (data) => data.period_end > data.period_start,
  { message: 'Periode akhir harus setelah periode awal', path: ['period_end'] }
);

// ============================================
// Type Exports
// ============================================

export type CreateBulkOrderInputType = z.infer<typeof CreateBulkOrderInput>;
export type CreateSubscriptionInputType = z.infer<typeof CreateSubscriptionInput>;
export type CancelSubscriptionInputType = z.infer<typeof CancelSubscriptionInput>;
export type InvoiceFilterQueryType = z.infer<typeof InvoiceFilterQuery>;
export type BulkOrderFilterQueryType = z.infer<typeof BulkOrderFilterQuery>;
export type GenerateInvoiceInputType = z.infer<typeof GenerateInvoiceInput>;
