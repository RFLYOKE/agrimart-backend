import cron from 'node-cron';
import prisma from '../../config/db';
import { notificationService } from '../notification/service';

export const startAnalyticsCron = () => {
  // Cron berjalan setiap jam di menit 0
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON Analytics] Mengecek Price Alerts...');
    
    try {
      // Ambil alert yang masih is_active dalam batch 100
      let hasMore = true;
      let lastId: string | undefined = undefined;

      while (hasMore) {
        const fetchQuery: any = {
          where: { is_active: true },
          take: 100,
          orderBy: { id: 'asc' },
          include: { product: true }
        };

        if (lastId) {
          fetchQuery.cursor = { id: lastId };
          fetchQuery.skip = 1;
        }

        const alerts = await prisma.priceAlert.findMany(fetchQuery) as any[];

        if (alerts.length === 0) {
          hasMore = false;
          break;
        }

        lastId = alerts[alerts.length - 1].id;

        for (const alert of alerts) {
          // Asumsi bahwa alert diukur terhadap harga B2C konsumen biasa (price_b2c)
          const currentPrice = Number(alert.product.price_b2c);
          const targetPrice = Number(alert.target_price);

          if (currentPrice <= targetPrice) {
            // Update the alert
            await prisma.priceAlert.update({
              where: { id: alert.id },
              data: {
                is_active: false,
                triggered_at: new Date(),
              }
            });

            // Send notification
            await notificationService.notifyPriceAlert(
              alert.user_id,
              alert.product_id,
              alert.product.name,
              targetPrice
            );
          }
        }
      }
      
      console.log('[CRON Analytics] Selesai mengecek Price Alerts.');
    } catch (error) {
      console.error('[CRON Analytics] Error pada Price Alert cron:', error);
    }
  });

  console.log('Analytics Cron (Price Alert) initialized.');
};
