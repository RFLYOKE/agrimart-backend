import { messaging } from '../../config/firebase';
import prisma from '../../config/db';

export class NotificationService {
  async getNotifications(userId: string) {
    // riwayat notifikasi 30 hari terakhir
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return (prisma as any).notification.findMany({
      where: { 
        user_id: userId,
        created_at: { gte: thirtyDaysAgo }
      },
      orderBy: { created_at: 'desc' }
    });
  }

  async registerToken(userId: string, token: string, deviceType: 'android' | 'ios' | 'web') {
    return (prisma as any).fCMToken.upsert({
      where: { token },
      update: {
        user_id: userId,
        device_type: deviceType,
        updated_at: new Date()
      },
      create: {
        user_id: userId,
        token: token,
        device_type: deviceType,
      }
    });
  }

  async sendToDevice(fcmToken: string, title: string, body: string, data?: Record<string, string>) {
    if (!messaging) return console.log('[Notification Bypass] ', { fcmToken, title, body });

    try {
      await messaging.send({
        token: fcmToken,
        notification: { title, body },
        data,
      });
    } catch (error) {
      console.error('Failed to send FCM to device:', error);
    }
  }

  async sendToMultiple(fcmTokens: string[], title: string, body: string, data?: Record<string, string>) {
    if (!messaging) return console.log('[Notification Bypass Multiple] ', { fcmTokens, title, body });
    if (!fcmTokens || fcmTokens.length === 0) return;

    try {
      const message = {
        tokens: fcmTokens,
        notification: { title, body },
        data,
      };
      const response = await messaging.sendEachForMulticast(message);
      if (response.failureCount > 0) {
        console.warn(`Failed to send ${response.failureCount} out of ${fcmTokens.length} multicasts.`);
      }
    } catch (error) {
      console.error('Failed to send multicast FCM:', error);
    }
  }

  private async notifyUser(userId: string, title: string, body: string, data?: Record<string, string>) {
    // 1. Save to DB for historical view
    await (prisma as any).notification.create({
      data: {
        user_id: userId,
        title,
        body,
        data: data || undefined,
      }
    });

    // 2. Fetch User FCM Tokens
    const userTokens = await (prisma as any).fCMToken.findMany({
      where: { user_id: userId }
    });

    const tokens = userTokens.map((t: any) => t.token);

    if (tokens.length > 0) {
      await this.sendToMultiple(tokens, title, body, data);
    }
  }

  async notifyOrderStatus(userId: string, orderId: string, newStatus: string) {
    const title = 'Pembaruan Order';
    const body = `Order #${orderId.substring(0,8)} berhasil ${newStatus}`;
    await this.notifyUser(userId, title, body, { type: 'order', orderId });
  }

  async notifyNewBid(auctionId: string, previousBidderId: string, newAmount: number) {
    const title = 'Seseorang Melewati Bid-mu!';
    const body = `Kamu kalah bid! Ada yang bid Rp ${newAmount.toLocaleString('id-ID')}`;
    await this.notifyUser(previousBidderId, title, body, { type: 'auction', auctionId });
  }

  async notifyAuctionWin(userId: string, auctionId: string, productName: string) {
    const title = 'Lelang Dimenangkan 🎉';
    const body = `Selamat! Kamu menang lelang ${productName}`;
    await this.notifyUser(userId, title, body, { type: 'auction', auctionId });
  }

  async notifyPriceAlert(userId: string, productId: string, productName: string, targetPrice: number) {
    const title = 'Alert Harga Agrikultur!';
    const body = `Harga ${productName} sudah turun ke Rp ${targetPrice.toLocaleString('id-ID')} sesuai targetmu!`;
    await this.notifyUser(userId, title, body, { type: 'price_alert', productId });
  }

  async notifyClaimUpdate(userId: string, claimId: string, status: string) {
    const title = 'Klaim Fresh Guarantee';
    const body = `Klaim Fresh Guarantee kamu ${status === 'approved' ? 'Disetujui ✅' : status === 'rejected' ? 'Ditolak ❌' : status}`;
    await this.notifyUser(userId, title, body, { type: 'claim', claimId });
  }
}

export const notificationService = new NotificationService();
