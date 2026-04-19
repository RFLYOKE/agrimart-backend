import { Server } from 'socket.io';
import { AuthSocket } from '../../config/socket';
import prisma from '../../config/db';
import redisClient from '../../config/redis';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const auctionSocketHandler = (io: Server) => {
  const auctionNamespace = io.of('/auction');

  // Middleware untuk verifikasi JWT
  auctionNamespace.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: Token not provided'));
      
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  auctionNamespace.on('connection', (socket: AuthSocket) => {
    const user = socket.data.user;

    // Supaya bisa kirim private message ke user spesifik (misal notif outbid)
    if (user) {
      socket.join(`user:${user.id}`);
    }

    socket.on('join_auction', (auctionId: string) => {
      socket.join(`auction:${auctionId}`);
    });

    socket.on('place_bid', async (data: { auction_id: string, amount: number }) => {
      try {
        const { auction_id, amount } = data;

        // Validasi auction aktif di Redis
        const cacheKey = `auction:active:${auction_id}`;
        const isActive = await redisClient.get(cacheKey);
        
        if (!isActive) {
          return socket.emit('error', { message: 'Auction is not active or has ended' });
        }

        // Jalankan Prisma transaction untuk update bid secara atomic
        const result = await prisma.$transaction(async (tx) => {
          const auction = await tx.auction.findUnique({
            where: { id: auction_id },
            include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
          });

          if (!auction || auction.status !== 'active') {
            throw new Error('Auction is unavailable');
          }

          if (Number(amount) <= Number(auction.current_price)) {
            throw new Error('Bid amount must be greater than current price');
          }

          const previousHighestBidderId = auction.bids[0]?.user_id;

          // Buat bid baru
          await tx.bid.create({
            data: {
              auction_id,
              user_id: user!.id,
              amount,
            }
          });

          // Update current_price
          const updatedAuction = await tx.auction.update({
            where: { id: auction_id },
            data: { current_price: amount },
          });

          // Hitung total bidders unik
          const totalBiddersData = await tx.bid.groupBy({
            by: ['user_id'],
            where: { auction_id },
          });

          return { 
            previousHighestBidderId, 
            updatedAuction,
            totalBidders: totalBiddersData.length
          };
        });

        const { previousHighestBidderId, updatedAuction, totalBidders } = result;

        // Broadcast 'bid_update' ke seluruh room
        auctionNamespace.to(`auction:${auction_id}`).emit('bid_update', {
          bidder_name: user!.id, // in real scenario, fetch user name or assign it beforehand
          amount,
          total_bidders: totalBidders
        });

        // Broadcast 'outbid' ke previous highest bidder jika ada dan berbeda dari bidder saat ini
        if (previousHighestBidderId && previousHighestBidderId !== user!.id) {
          auctionNamespace.to(`user:${previousHighestBidderId}`).emit('outbid', {
            auction_id,
            new_amount: amount,
          });
        }

      } catch (error: any) {
        socket.emit('error', { message: error.message || 'Failed to place bid' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User ${user?.id} disconnected from auction namespace`);
    });
  });
};

/**
 * Helper: startAuctionTimer
 * Set durasi lelang di Redis
 */
export const startAuctionTimer = async (auctionId: string, durationSeconds: number) => {
  const endTime = new Date(Date.now() + durationSeconds * 1000);
  
  // Set di Redis dengan expiration sesuai durasi (cache secara otomatis hilang saat expire)
  await redisClient.setEx(`auction:active:${auctionId}`, durationSeconds, endTime.toISOString());
};
