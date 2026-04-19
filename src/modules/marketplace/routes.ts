import { Router } from 'express';
import { MarketplaceController } from './controller';
// import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new MarketplaceController();

// Public routes
router.get('/products', controller.getProducts);
router.get('/products/:id', controller.getProductById);
router.get('/categories', controller.getCategories);

// Protected routes
// router.post('/products', authenticate, controller.createProduct);
// router.put('/products/:id', authenticate, controller.updateProduct);
// router.delete('/products/:id', authenticate, controller.deleteProduct);

export default router;
