import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { prisma } from '../../src/config/db';
import { describe, it, expect, beforeEach, beforeAll, afterAll, jest } from '@jest/globals';

// Mock DB
jest.mock('../../src/config/db', () => ({
  prisma: {
    auctionBid: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    auction: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(prisma)),
  },
}));

// A simplified version of auction handler to test logic without full application bootstrap
const setupAuctionSocket = (io: Server) => {
  io.on('connection', (socket) => {
    socket.on('join_auction', (auctionId) => {
      socket.join(`auction_${auctionId}`);
    });

    socket.on('place_bid', async (data: { auctionId: string, amount: number, userId: string }) => {
      try {
        const auction = await prisma.auction.findUnique({ where: { id: data.auctionId } });
        if (!auction) {
          socket.emit('error', { message: 'Auction not found' });
          return;
        }

        if (data.amount <= Number(auction.current_price)) {
          socket.emit('error', { message: 'Bid amount must be higher than current price' });
          return;
        }

        // Simulating the update
        await prisma.auction.update({
          where: { id: data.auctionId },
          data: { current_price: data.amount },
        });

        io.to(`auction_${data.auctionId}`).emit('bid_update', {
          auctionId: data.auctionId,
          newPrice: data.amount,
          lastBidderId: data.userId
        });
      } catch (err: any) {
        socket.emit('error', { message: err.message });
      }
    });
  });
};

describe('Auction Socket Event Tests', () => {
  let io: Server;
  let clientSocket: ClientSocket;
  let httpServer: any;

  beforeAll((done: any) => {
    httpServer = createServer();
    io = new Server(httpServer);
    setupAuctionSocket(io);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Bid valid: amount > current_price -> current_price terupdate', (done: any) => {
    (prisma.auction.findUnique as jest.Mock<any>).mockResolvedValue({
      id: 'auc_1',
      current_price: 10000,
    });

    clientSocket.emit('join_auction', 'auc_1');

    clientSocket.on('bid_update', (data) => {
      expect(data.newPrice).toBe(15000);
      expect(prisma.auction.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'auc_1' },
        data: { current_price: 15000 }
      }));
      clientSocket.off('bid_update'); // cleanup listener
      done();
    });

    clientSocket.emit('place_bid', {
      auctionId: 'auc_1',
      amount: 15000,
      userId: 'user_1'
    });
  });

  it('Bid invalid: amount <= current_price -> error event dikirim balik ke client', (done: any) => {
    (prisma.auction.findUnique as jest.Mock<any>).mockResolvedValue({
      id: 'auc_1',
      current_price: 10000,
    });

    clientSocket.on('error', (data) => {
      expect(data.message).toMatch(/higher than current price/i);
      expect(prisma.auction.update).not.toHaveBeenCalled();
      clientSocket.off('error'); // cleanup
      done();
    });

    clientSocket.emit('place_bid', {
      auctionId: 'auc_1',
      amount: 9000,
      userId: 'user_1'
    });
  });
});
