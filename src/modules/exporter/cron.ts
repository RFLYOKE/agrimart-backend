import cron from 'node-cron';
import exporterService from './service';
import logger from '../../utils/logger';

export const startExporterCrons = () => {
  // 1. Currency Rates Updater - Setiap 6 jam
  cron.schedule('0 */6 * * *', async () => {
    logger.info('[CRON] Updating currency rates...');
    await exporterService.updateCurrencyRates();
  });

  // 2. Export Documents Expiry Check - Setiap hari jam 07:00
  cron.schedule('0 7 * * *', async () => {
    logger.info('[CRON] Checking expiring export documents...');
    await exporterService.checkExpiringDocs();
  });

  logger.info('Exporter Cron Jobs initialized.');

  // Optional: Jalankan cron currency update pertama kali server statup (karena 6 jam terlalu lama menunggu)
  setTimeout(() => {
    exporterService.updateCurrencyRates().catch((e) => logger.error('Init Currency Error:', e));
  }, 5000); // Tunggu 5 detik agar koneksi DB stabil
};
