import { Request, Response, NextFunction } from 'express';

/**
 * Request Validation Middleware
 * 
 * Generic validation middleware that can be used with any schema validator
 * (e.g., Zod, Joi, Yup)
 * 
 * TODO: Install and integrate a schema validation library (recommended: zod)
 */

type ValidationSchema = {
  parse: (data: unknown) => unknown;
};

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Creates a validation middleware for the specified target
 * 
 * @param schema - Schema validator object with a `parse` method
 * @param target - Which part of the request to validate (body, query, params)
 * 
 * @example
 * ```ts
 * import { z } from 'zod';
 * 
 * const loginSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 * 
 * router.post('/login', validate(loginSchema, 'body'), loginController);
 * ```
 */
export const validate = (schema: ValidationSchema, target: ValidateTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      schema.parse(data);
      next();
    } catch (error: unknown) {
      const validationError = error as { errors?: Array<{ message: string; path: string[] }> };
      
      res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: validationError.errors?.map((err) => ({
          field: err.path?.join('.'),
          message: err.message,
        })) || [],
      });
    }
  };
};
