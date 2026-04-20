import { z } from 'zod';

// ============================================
// Query & Filter Schemas
// ============================================

/**
 * Filter untuk list semua user
 * Mendukung: filter by role, status, search, dan pagination
 */
export const UserFilterQuery = z.object({
  role: z.enum(['koperasi', 'konsumen', 'hotel_restoran', 'eksportir', 'admin']).optional(),
  status: z.enum(['active', 'suspended', 'banned']).optional(),
  search: z.string().optional(),    // Cari berdasarkan nama, email, atau nomor HP
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Filter untuk analytics endpoint
 */
export const AnalyticsQuery = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

/**
 * Filter untuk claims list
 */
export const ClaimFilterQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================
// Input Schemas (Body)
// ============================================

/**
 * Input untuk verifikasi koperasi (approve/reject)
 */
export const VerifyCoopInput = z.object({
  coop_id: z.string().uuid('ID koperasi harus berupa UUID valid'),
  action: z.enum(['approve', 'reject'], {
    error: 'Action harus berupa "approve" atau "reject"',
  }),
  reason: z.string().min(10, 'Alasan minimal 10 karakter').optional(),
}).refine(
  (data) => {
    // Jika action = reject, reason wajib diisi
    if (data.action === 'reject' && !data.reason) {
      return false;
    }
    return true;
  },
  { message: 'Alasan penolakan wajib diisi saat action = reject', path: ['reason'] }
);

/**
 * Input untuk update status user (active/suspended/banned)
 */
export const UpdateUserStatusInput = z.object({
  status: z.enum(['active', 'suspended', 'banned'], {
    error: 'Status harus berupa "active", "suspended", atau "banned"',
  }),
  reason: z.string().min(5, 'Alasan minimal 5 karakter'),
});

// ============================================
// Type Exports
// ============================================

export type UserFilterQueryType = z.infer<typeof UserFilterQuery>;
export type AnalyticsQueryType = z.infer<typeof AnalyticsQuery>;
export type ClaimFilterQueryType = z.infer<typeof ClaimFilterQuery>;
export type VerifyCoopInputType = z.infer<typeof VerifyCoopInput>;
export type UpdateUserStatusInputType = z.infer<typeof UpdateUserStatusInput>;
