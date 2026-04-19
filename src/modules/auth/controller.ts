import { Request, Response } from 'express';
import { AuthService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

const authService = new AuthService();

export class AuthController {
  /**
   * POST /api/auth/register
   * Register a new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(req.body);
      successResponse(res, result, 'User registered successfully', 201);
    } catch (error: any) {
      errorResponse(res, error.message || 'Registration failed', 400);
    }
  }

  /**
   * POST /api/auth/login
   * Login with email and password
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      successResponse(res, result, 'Login successful');
    } catch (error: any) {
      errorResponse(res, error.message || 'Login failed', 401);
    }
  }

  /**
   * POST /api/auth/refresh-token
   * Refresh access token using refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshToken(refreshToken);
      successResponse(res, result, 'Token refreshed successfully');
    } catch (error: any) {
      errorResponse(res, error.message || 'Token refresh failed', 401);
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user and invalidate tokens
   */
  async logout(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }
      
      await authService.logout(userId);
      successResponse(res, null, 'Logged out successfully');
    } catch (error: any) {
      errorResponse(res, error.message || 'Logout failed', 500);
    }
  }
}
