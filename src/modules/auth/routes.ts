import { Router } from 'express';
import { AuthController } from './controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { loginSchema, registerSchema, refreshTokenSchema } from './schema';

const router = Router();
const authController = new AuthController();

// Public routes
router.post('/register', validate(registerSchema, 'body'), authController.register);
router.post('/login', validate(loginSchema, 'body'), authController.login);
router.post('/refresh-token', validate(refreshTokenSchema, 'body'), authController.refreshToken);

// Protected routes
router.post('/logout', authenticate, authController.logout);

export default router;
