/**
 * Auction Validation Schemas
 * 
 * TODO: Define with Zod after installation
 */

export interface CreateAuctionSchema {
  productId: string;
  title: string;
  description: string;
  startingPrice: number;
  minBidIncrement: number;
  startTime: string;   // ISO date
  endTime: string;      // ISO date
  images?: string[];
}

export interface PlaceBidSchema {
  amount: number;
  bidderId: string;
}

export interface AuctionQuerySchema {
  page?: number;
  limit?: number;
  status?: 'upcoming' | 'active' | 'ended';
  category?: string;
  sortBy?: 'startTime' | 'endTime' | 'currentPrice';
  sortOrder?: 'asc' | 'desc';
}
