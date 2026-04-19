import { Router } from 'express';
import { NotificationController } from './controller';
// import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new NotificationController();

// All notification routes are protected
// router.get('/', authenticate, controller.getNotifications);
// router.get('/unread-count', authenticate, controller.getUnreadCount);
// router.put('/:id/read', authenticate, controller.markAsRead);
// router.put('/read-all', authenticate, controller.markAllAsRead);
// router.delete('/:id', authenticate, controller.deleteNotification);

// Temporary public routes for development
router.get('/', controller.getNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.put('/:id/read', controller.markAsRead);
router.put('/read-all', controller.markAllAsRead);
router.delete('/:id', controller.deleteNotification);

export default router;
