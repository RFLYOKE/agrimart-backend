/**
 * Notification Validation Schemas
 * 
 * TODO: Define with Zod after installation
 */

export interface NotificationSchema {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'order' | 'auction' | 'consult' | 'promo' | 'system';
  data?: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface NotificationQuerySchema {
  page?: number;
  limit?: number;
  type?: 'order' | 'auction' | 'consult' | 'promo' | 'system';
  read?: boolean;
}
