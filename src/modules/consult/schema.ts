/**
 * Consult Validation Schemas
 * 
 * TODO: Define with Zod after installation
 */

export interface ExpertSchema {
  name: string;
  specialization: string;
  bio: string;
  pricePerSession: number;
  avatar?: string;
  rating?: number;
}

export interface CreateSessionSchema {
  expertId: string;
  topic: string;
  description?: string;
  scheduledAt?: string; // ISO date for scheduled consultation
}

export interface SendMessageSchema {
  content: string;
  type: 'text' | 'image' | 'file';
  attachmentUrl?: string;
}

export interface ExpertQuerySchema {
  page?: number;
  limit?: number;
  specialization?: string;
  search?: string;
  minRating?: number;
  sortBy?: 'rating' | 'price' | 'name';
  sortOrder?: 'asc' | 'desc';
}
