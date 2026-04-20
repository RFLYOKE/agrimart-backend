import cron from 'node-cron';
import hotelService from './service';
import logger from '../../utils/logger';

/**
 * Hotel Subscription Cron Job
 * Berjalan setiap hari jam 06:00 WIB (23:00 UTC)
 * Memproses semua kontrak langganan aktif yang jatuh tempo hari ini
 */
export const startHotelSubscriptionCron = () => {
  // Jam 06:00 WIB = 23:00 UTC hari sebelumnya
  cron.schedule('0 23 * * *', async () => {
    logger.info('[CRON Hotel] Starting daily subscription order processing...');

    try {
      const result = await hotelService.processSubscriptionOrders();
      logger.info(`[CRON Hotel] Completed. Processed ${result.processed} subscription orders.`);
    } catch (error) {
      logger.error('[CRON Hotel] Error processing subscription orders:', error);
    }
  });

  logger.info('Hotel Subscription Cron Job initialized (daily at 06:00 WIB).');
};
