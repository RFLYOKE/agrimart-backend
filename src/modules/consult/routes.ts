import { Router } from 'express';
import { ConsultController } from './controller';
// import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new ConsultController();

// Public routes
router.get('/experts', controller.getExperts);
router.get('/experts/:id', controller.getExpertById);

// Protected routes
// router.post('/sessions', authenticate, controller.createSession);
// router.get('/sessions', authenticate, controller.getSessions);
// router.get('/sessions/:id', authenticate, controller.getSessionById);
// router.post('/sessions/:id/messages', authenticate, controller.sendMessage);

export default router;
