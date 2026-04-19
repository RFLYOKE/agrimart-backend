import { Request } from 'express';

/**
 * Pagination Utility
 * 
 * Provides helpers for consistent pagination across all endpoints
 */

export interface PaginationQuery {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Extract pagination parameters from request query
 * 
 * @param req - Express Request object
 * @param defaultLimit - Default items per page (default: 10)
 * @param maxLimit - Maximum items per page (default: 100)
 * 
 * @example
 * ```ts
 * const { page, limit, offset } = getPagination(req);
 * const users = await User.findAll({ limit, offset });
 * ```
 */
export const getPagination = (
  req: Request,
  defaultLimit: number = 10,
  maxLimit: number = 100
): PaginationQuery => {
  let page = parseInt(req.query.page as string, 10) || 1;
  let limit = parseInt(req.query.limit as string, 10) || defaultLimit;

  // Ensure valid values
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), maxLimit);

  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build paginated response object
 * 
 * @param data - Array of items for current page
 * @param totalItems - Total number of items across all pages
 * @param page - Current page number
 * @param limit - Items per page
 * 
 * @example
 * ```ts
 * const result = buildPaginatedResponse(users, totalCount, page, limit);
 * return successResponse(res, result, 'Users fetched successfully');
 * ```
 */
export const buildPaginatedResponse = <T>(
  data: T[],
  totalItems: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

export const paginate = (page: number = 1, limit: number = 10) => {
  const p = Math.max(1, Number(page));
  const l = Math.max(1, Number(limit));
  const skip = (p - 1) * l;
  const take = l;

  return { skip, take };
};

export const paginationMeta = (total: number, page: number = 1, limit: number = 10) => {
  const p = Math.max(1, Number(page));
  const l = Math.max(1, Number(limit));
  const totalPages = Math.ceil(total / l);

  return { total, page: p, limit: l, totalPages };
};
