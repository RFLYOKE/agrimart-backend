import { Router } from 'express';
import { AuctionController } from './controller';
// import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new AuctionController();

// Public routes
router.get('/', controller.getAuctions);
router.get('/:id', controller.getAuctionById);

// Protected routes
// router.post('/', authenticate, controller.createAuction);
// router.post('/:id/bid', authenticate, controller.placeBid);
// router.put('/:id', authenticate, controller.updateAuction);
// router.delete('/:id', authenticate, controller.deleteAuction);

export default router;
