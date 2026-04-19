/**
 * Marketplace Validation Schemas
 * 
 * TODO: Define with Zod after installation
 */

export interface CreateProductSchema {
  name: string;
  description: string;
  price: number;
  stock: number;
  categoryId: string;
  unit: string; // kg, ikat, buah, dll
  images?: string[];
  farmerId: string;
}

export interface UpdateProductSchema {
  name?: string;
  description?: string;
  price?: number;
  stock?: number;
  categoryId?: string;
  unit?: string;
  images?: string[];
}

export interface ProductQuerySchema {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}
