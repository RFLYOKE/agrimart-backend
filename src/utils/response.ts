import { Response } from 'express';

/**
 * Standard API Response Helpers
 * 
 * Ensures consistent response format across all endpoints
 */

interface SuccessResponseData {
  success: true;
  message: string;
  data: unknown;
}

interface ErrorResponseData {
  success: false;
  message: string;
  errors?: unknown;
}

/**
 * Send a success response
 * 
 * @param res - Express Response object
 * @param data - Response payload
 * @param message - Success message
 * @param statusCode - HTTP status code (default: 200)
 * 
 * @example
 * ```ts
 * successResponse(res, { user: userData }, 'User created successfully', 201);
 * ```
 */
export const successResponse = (
  res: Response,
  data: unknown = null,
  message: string = 'Success',
  statusCode: number = 200
): Response<SuccessResponseData> => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send an error response
 * 
 * @param res - Express Response object
 * @param message - Error message
 * @param statusCode - HTTP status code (default: 500)
 * @param errors - Additional error details (validation errors, etc.)
 * 
 * @example
 * ```ts
 * errorResponse(res, 'User not found', 404);
 * errorResponse(res, 'Validation failed', 422, validationErrors);
 * ```
 */
export const errorResponse = (
  res: Response,
  message: string = 'Internal Server Error',
  statusCode: number = 500,
  errors?: unknown
): Response<ErrorResponseData> => {
  const response: ErrorResponseData = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};
