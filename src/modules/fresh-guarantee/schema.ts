import { z } from 'zod';

export const ConfirmReceiptInput = z.object({
  order_id: z.string().uuid(),
  condition: z.enum(['fresh', 'not_fresh']),
  photo_urls: z.array(z.string().url()).optional(),
});

export const CreateClaimInput = z.object({
  order_id: z.string().uuid(),
  issue_type: z.enum(['not_fresh', 'wrong_item', 'damaged', 'incomplete']),
  description: z.string().optional(),
  photo_urls: z.array(z.string().url()),
  refund_type: z.enum(['full', 'partial']),
});
