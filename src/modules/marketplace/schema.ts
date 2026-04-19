import { z } from 'zod';

export const CreateProductInput = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price_b2c: z.number().positive(),
  price_b2b: z.number().positive(),
  stock: z.number().int().nonnegative(),
  category: z.string().optional(),
  images: z.array(z.string()).default([]),
});

export const UpdateProductInput = CreateProductInput.partial();

export const CreateOrderInput = z.object({
  items: z.array(
    z.object({
      product_id: z.string().uuid(),
      qty: z.number().int().positive(),
    })
  ).min(1, 'Order must contain at least one item'),
  address: z.object({
    street: z.string(),
    city: z.string(),
    province: z.string(),
    postal_code: z.string(),
  }),
  payment_method: z.enum(['va_bca', 'va_mandiri', 'gopay', 'qris', 'cod']),
});

export const OrderFilterQuery = z.object({
  status: z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type CreateProductType = z.infer<typeof CreateProductInput>;
export type UpdateProductType = z.infer<typeof UpdateProductInput>;
export type CreateOrderType = z.infer<typeof CreateOrderInput>;
export type OrderFilterQueryType = z.infer<typeof OrderFilterQuery>;
