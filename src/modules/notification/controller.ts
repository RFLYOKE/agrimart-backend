import { Request, Response } from 'express';
import { NotificationService } from './service';
import { successResponse, errorResponse } from '../../utils/response';

const service = new NotificationService();

export class NotificationController {
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getNotifications(req.query);
      successResponse(res, result, 'Notifications fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch notifications', 500);
    }
  }

  async getUnreadCount(_req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getUnreadCount();
      successResponse(res, result, 'Unread count fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch unread count', 500);
    }
  }

  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.markAsRead(req.params.id as string);
      successResponse(res, result, 'Notification marked as read');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to mark notification', 400);
    }
  }

  async markAllAsRead(_req: Request, res: Response): Promise<void> {
    try {
      const result = await service.markAllAsRead();
      successResponse(res, result, 'All notifications marked as read');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to mark all notifications', 500);
    }
  }

  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      await service.deleteNotification(req.params.id as string);
      successResponse(res, null, 'Notification deleted successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to delete notification', 500);
    }
  }
}
