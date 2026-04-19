import { Request, Response } from 'express';
import { ConsultService } from './service';
import { successResponse, errorResponse } from '../../utils/response';

const service = new ConsultService();

export class ConsultController {
  async getExperts(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getExperts(req.query);
      successResponse(res, result, 'Experts fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch experts', 500);
    }
  }

  async getExpertById(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getExpertById(req.params.id as string);
      successResponse(res, result, 'Expert fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch expert', 404);
    }
  }

  async createSession(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.createSession(req.body);
      successResponse(res, result, 'Consultation session created', 201);
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to create session', 400);
    }
  }

  async getSessions(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getSessions(req.query);
      successResponse(res, result, 'Sessions fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch sessions', 500);
    }
  }

  async getSessionById(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.getSessionById(req.params.id as string);
      successResponse(res, result, 'Session fetched successfully');
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to fetch session', 404);
    }
  }

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const result = await service.sendMessage(req.params.id as string, req.body);
      successResponse(res, result, 'Message sent successfully', 201);
    } catch (error: unknown) {
      const err = error as Error;
      errorResponse(res, err.message || 'Failed to send message', 400);
    }
  }
}
