import { z } from 'zod';

// ============================================
// Exporter — Zod Schemas
// ============================================

export const CreateRFQInput = z.object({
  title: z.string().min(5, 'Judul minimal 5 karakter'),
  commodity: z.string().min(3, 'Nama komoditas minimal 3 karakter'),
  category: z.enum(['pertanian', 'perikanan', 'peternakan'], {
    error: 'Kategori tidak valid',
  }),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  target_price_per_unit: z.number().positive(),
  currency: z.enum(['IDR', 'USD', 'EUR', 'JPY', 'SGD', 'AUD'], {
    error: 'Mata uang tidak didukung',
  }),
  delivery_port: z.string().min(3),
  required_certifications: z.array(z.string()).default([]),
  delivery_deadline: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Deadline harus di masa depan',
  }),
  description: z.string().optional(),
});

export const SubmitQuoteInput = z.object({
  rfq_id: z.string().uuid(),
  price_per_unit: z.number().positive(),
  available_quantity: z.number().positive(),
  delivery_date: z.coerce.date().refine((d) => d > new Date(), {
    message: 'Tanggal pengiriman harus di masa depan',
  }),
  notes: z.string().optional(),
  certifications_available: z.array(z.string()).default([]),
});

export const AwardQuoteInput = z.object({
  rfq_id: z.string().uuid(),
  quote_id: z.string().uuid(),
});

export const UploadExportDocInput = z.object({
  order_id: z.string().uuid().optional(),
  rfq_id: z.string().uuid().optional(),
  doc_type: z.enum(
    [
      'phytosanitary',
      'health_certificate',
      'certificate_of_origin',
      'packing_list',
      'commercial_invoice',
      'bill_of_lading',
    ],
    { error: 'Tipe dokumen tidak valid' }
  ),
  doc_url: z.string().url('URL dokumen tidak valid'), // Misal URL presigned S3/Firebase
  issued_by: z.string().min(3),
  issue_date: z.coerce.date(),
  expiry_date: z.coerce.date(),
}).refine((data) => data.expiry_date > data.issue_date, {
  message: 'Tanggal kadaluarsa harus setelah tanggal terbit',
  path: ['expiry_date'],
});

export const OpenRFQFilterQuery = z.object({
  category: z.enum(['pertanian', 'perikanan', 'peternakan']).optional(),
  commodity: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const ExportDocFilterQuery = z.object({
  doc_type: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'expired']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ============================================
// Type Exports
// ============================================

export type CreateRFQInputType = z.infer<typeof CreateRFQInput>;
export type SubmitQuoteInputType = z.infer<typeof SubmitQuoteInput>;
export type AwardQuoteInputType = z.infer<typeof AwardQuoteInput>;
export type UploadExportDocInputType = z.infer<typeof UploadExportDocInput>;
export type OpenRFQFilterQueryType = z.infer<typeof OpenRFQFilterQuery>;
export type ExportDocFilterQueryType = z.infer<typeof ExportDocFilterQuery>;
