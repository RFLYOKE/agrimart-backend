import { Request, Response } from 'express';
import { notificationService } from './service';
import { successResponse, errorResponse } from '../../utils/response';
import { AuthRequest } from '../../middleware/auth';

export class NotificationController {
  async registerToken(req: AuthRequest, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      const { token, device_type } = req.body;

      if (!userId) return errorResponse(res, 'Unauthorized', 401);
      if (!token) return errorResponse(res, 'FCM token is required', 400);

      const type = device_type && ['android', 'ios', 'web'].includes(device_type) ? device_type : 'android';

      await notificationService.registerToken(userId, token, type);
      return successResponse(res, null, 'FCM token registered successfully');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to register token', 400);
    }
  }

  async getHistory(req: AuthRequest, res: Response): Promise<any> {
    try {
      const userId = req.user?.id;
      if (!userId) return errorResponse(res, 'Unauthorized', 401);

      const history = await notificationService.getNotifications(userId);
      return successResponse(res, history, 'Notification history retrieved safely');
    } catch (error: any) {
      return errorResponse(res, error.message || 'Failed to retrieve notification history', 400);
    }
  }
}
