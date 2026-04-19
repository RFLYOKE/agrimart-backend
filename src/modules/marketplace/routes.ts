import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { MarketplaceController } from './controller';
import { CreateProductInput, UpdateProductInput, CreateOrderInput, OrderFilterQuery } from './schema';

const router = Router();
const controller = new MarketplaceController();

// Public routes
router.get('/products', controller.getProducts);
router.get('/products/:id', controller.getProductById);

// Protected cooperative routes
router.post(
  '/products',
  authenticate,
  authorize('koperasi'),
  validate(CreateProductInput, 'body'),
  controller.createProduct
);

router.put(
  '/products/:id',
  authenticate,
  authorize('koperasi'),
  validate(UpdateProductInput, 'body'),
  controller.updateProduct
);

router.put(
  '/orders/:id/status',
  authenticate,
  authorize('koperasi'),
  // optionally add validation for status payload
  controller.updateOrderStatus
);

// Protected user routes
router.post(
  '/orders',
  authenticate,
  validate(CreateOrderInput, 'body'),
  controller.createOrder
);

router.get(
  '/orders/my',
  authenticate,
  validate(OrderFilterQuery, 'query'),
  controller.getMyOrders
);

export default router;
