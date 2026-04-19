import cron from 'node-cron';
import prisma from '../../config/db';
import { io } from '../../config/socket';

export const startAuctionCron = () => {
  // Cron berjalan setiap menit
  cron.schedule('* * * * *', async () => {
    console.log('[CRON] Mengecek auction yang sudah melewati end_time...');
    
    try {
      const now = new Date();

      // Cari auction yang masih active dan waktunya sudah habis
      const expiredAuctions = await prisma.auction.findMany({
        where: {
          status: 'active',
          end_time: {
            lte: now,
          },
        },
        include: {
          bids: {
            orderBy: { amount: 'desc' },
            take: 1, // Ambil bid tertinggi
            include: { user: true },
          },
        },
      });

      for (const auction of expiredAuctions) {
        // Tutup auction
        await prisma.auction.update({
          where: { id: auction.id },
          data: { status: 'closed' },
        });

        const highestBid = auction.bids[0];
        
        if (highestBid) {
          console.log(`[CRON] Auction ${auction.id} dimenangkan oleh user ${highestBid.user.id}`);
          
          // Kirim FCM ke pemenang (Mock)
          // notificationService.sendFCM(highestBid.user.id, 'Pemenang Lelang!', `Selamat, Anda memenangkan lelang dengan bid ${highestBid.amount}`);
          
          // Opsional: Jika kita butuh notifikasi via socket untuk user yang sedang online
          if (io) {
            io.of('/auction').to(`user:${highestBid.user.id}`).emit('auction_won', {
              auction_id: auction.id,
              amount: highestBid.amount,
            });
            // Update UI semua orang di room tersebut
            io.of('/auction').to(`auction:${auction.id}`).emit('auction_ended', {
              winnerId: highestBid.user.id,
              finalPrice: highestBid.amount
            });
          }
        } else {
          console.log(`[CRON] Auction ${auction.id} ditutup tanpa pemenang (tidak ada bid).`);
          if (io) {
            io.of('/auction').to(`auction:${auction.id}`).emit('auction_ended', {
              winnerId: null,
              finalPrice: auction.start_price
            });
          }
        }
      }
    } catch (error) {
      console.error('[CRON] Terjadi kesalahan saat memeriksa auction:', error);
    }
  });
  
  console.log('Auction Cron Job initialized.');
};
