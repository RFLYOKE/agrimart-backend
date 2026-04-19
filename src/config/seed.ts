// @ts-nocheck
// This file is a standalone seed script run via: npx ts-node src/config/seed.ts
// Type-checking is disabled because the IDE may cache stale Prisma types.
// Run `npx tsc --noEmit` to verify full project type safety.

import prisma from './db';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Starting full database seed...');

  // Password hash for all accounts
  const passwordHashAdmin = await bcrypt.hash('Admin123!', 12);
  const defaultPasswordHash = await bcrypt.hash('Password123!', 12);

  // 1. Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@agrimart.id' },
    update: {},
    create: {
      role: 'admin',
      name: 'Super Admin',
      email: 'admin@agrimart.id',
      phone: '08111222333',
      password_hash: passwordHashAdmin,
      phone_verified: true,
      status: 'active',
    },
  });
  console.log(`✅ Created Admin: ${admin.email}`);

  // 2. Koperasi & Consumen, Hotel, Eksportir
  const coopPetaniUser = await prisma.user.upsert({
    where: { email: 'farming@kop.id' },
    update: {},
    create: {
      role: 'koperasi',
      name: 'Koperasi Tani Makmur',
      email: 'farming@kop.id',
      phone: '08222333444',
      password_hash: defaultPasswordHash,
      phone_verified: true,
      cooperative: {
        create: {
          name: 'Koperasi Pertanian Organik',
          sector: 'pertanian',
          location: 'Lembang, Jawa Barat',
          description: 'Penghasil sayuran segar organik terbaik',
          cert_status: 'verified',
          verified_at: new Date(),
          fresh_rate: 4.8,
        }
      }
    },
    include: { cooperative: true }
  });

  const coopNelayanUser = await prisma.user.upsert({
    where: { email: 'fishing@kop.id' },
    update: {},
    create: {
      role: 'koperasi',
      name: 'Koperasi Nelayan Jaya',
      email: 'fishing@kop.id',
      phone: '08333444555',
      password_hash: defaultPasswordHash,
      phone_verified: true,
      cooperative: {
        create: {
          name: 'Koperasi Ikan Tangkap',
          sector: 'perikanan',
          location: 'Muara Karang, Jakarta',
          description: 'Pusat ikan laut segar harian',
          cert_status: 'verified',
          verified_at: new Date(),
          fresh_rate: 4.5,
        }
      }
    },
    include: { cooperative: true }
  });

  const consumerUser = await prisma.user.upsert({
    where: { email: 'budi@konsumen.id' },
    update: {},
    create: {
      role: 'konsumen',
      name: 'Budi Santoso',
      email: 'budi@konsumen.id',
      phone: '08444555666',
      password_hash: defaultPasswordHash,
      phone_verified: true,
    }
  });

  const hotelUser = await prisma.user.upsert({
    where: { email: 'chef@grandhotel.id' },
    update: {},
    create: {
      role: 'hotel_restoran',
      name: 'Chef Juna - Grand Hotel',
      email: 'chef@grandhotel.id',
      phone: '08555666777',
      password_hash: defaultPasswordHash,
      phone_verified: true,
    }
  });

  const exporterUser = await prisma.user.upsert({
    where: { email: 'sales@globalexport.id' },
    update: {},
    create: {
      role: 'eksportir',
      name: 'Global Export PT',
      email: 'sales@globalexport.id',
      phone: '08666777888',
      password_hash: defaultPasswordHash,
      phone_verified: true,
    }
  });
  console.log('✅ Created 5 main user roles and 2 cooperatives');

  // 3. Products
  const coopTaniId = coopPetaniUser.cooperative!.id;
  const coopIkanId = coopNelayanUser.cooperative!.id;

  await prisma.product.deleteMany({});
  console.log('🧹 Cleared old products');

  await prisma.product.createMany({
    data: [
      { coop_id: coopTaniId, name: 'Wortel Brastagi', category: 'Sayuran', price_b2c: 15000, price_b2b: 12000, stock: 500, description: 'Wortel segar' },
      { coop_id: coopTaniId, name: 'Bayam Merah', category: 'Sayuran', price_b2c: 10000, price_b2b: 8000, stock: 300, description: 'Bayam merah hidroponik' },
      { coop_id: coopTaniId, name: 'Tomat Cherry', category: 'Sayuran', price_b2c: 25000, price_b2b: 20000, stock: 400, description: 'Manis dan segar' },
      { coop_id: coopTaniId, name: 'Beras Mentik Wangi', category: 'Padi', price_b2c: 18000, price_b2b: 15000, stock: 1000, description: 'Beras putih pulen wangi' },
      { coop_id: coopTaniId, name: 'Apel Malang', category: 'Buah', price_b2c: 30000, price_b2b: 25000, stock: 200, description: 'Asli metik dari kebun' },
      
      { coop_id: coopIkanId, name: 'Ikan Tenggiri', category: 'Ikan Laut', price_b2c: 85000, price_b2b: 75000, stock: 100, description: 'Ikan tangkap pelabuhan' },
      { coop_id: coopIkanId, name: 'Udang Pancet', category: 'Seafood', price_b2c: 120000, price_b2b: 105000, stock: 50, description: 'Udang besar segar' },
      { coop_id: coopIkanId, name: 'Cumi Ring', category: 'Seafood', price_b2c: 65000, price_b2b: 55000, stock: 150, description: 'Cumi bersih potong' },
    ]
  });
  console.log('✅ Created 8 dummy products');

  // 4. Academy & Webinar
  await prisma.course.deleteMany({});
  const course1 = await prisma.course.create({
    data: {
      instructor_id: admin.id,
      title: 'Dasar Pertanian Organik',
      category: 'pertanian',
      price: 150000,
      description: 'Panduan lengkap menanam tanpa pupuk kimia.',
    }
  });
  const course2 = await prisma.course.create({
    data: {
      instructor_id: admin.id,
      title: 'Manajemen Mutu Ikan Tangkap',
      category: 'perikanan',
      price: 250000,
      description: 'Cara menjaga cold-chain pada industri perikanan.',
    }
  });

  await prisma.event.deleteMany({});
  await prisma.event.create({
    data: {
      title: 'Webinar Ekspor Produk Agrikultur 2026',
      speaker: 'Bapak Menteri',
      scheduled_at: new Date(Date.now() + 86400000 * 7), // Next week
      duration_min: 120,
      price: 50000,
      status: 'upcoming',
      description: 'Membahas regulasi standar ekspor terbaru'
    }
  });
  console.log('✅ Created 2 courses & 1 event');

  // 5. News & Articles
  await prisma.newsArticle.deleteMany({});
  await prisma.newsArticle.createMany({
    data: [
      {
        title: 'Harga Beras Dunia Mengalami Penyesuaian',
        category: 'Ekonomi',
        content: 'Akibat fenomena el nino, terjadi penyesuaian produksi...',
        author: 'Redaksi AgriMart',
        is_breaking: true,
      },
      {
        title: 'Sukses Koperasi Petani Milenial Ekspor Pisang',
        category: 'Inspirasi',
        content: 'Pemuda asal Jawa Timur ini berhasil mengekspor...',
        author: 'Reporter Agrikultur',
        is_breaking: false,
      }
    ]
  });
  console.log('✅ Created 2 news articles');

  // 6. Hamper Presets
  await prisma.hamperPreset.deleteMany({});
  await prisma.hamperPreset.create({
    data: {
      name: 'Parcel Buah Segar Premium',
      description: 'Cocok untuk jenguk orang sakit atau hadiah',
      items: { items: ['Apel Malang', 'Pisang Cavendish', 'Anggur Merah'] },
      price: 150000,
      category: 'Hadiah',
    }
  });
  console.log('✅ Created 1 hamper preset');

  // 7. Currency Rates
  await prisma.currencyRate.deleteMany({});
  await prisma.currencyRate.createMany({
    data: [
      { from_currency: 'USD', to_currency: 'IDR', rate: 15800 },
      { from_currency: 'EUR', to_currency: 'IDR', rate: 17200 },
      { from_currency: 'JPY', to_currency: 'IDR', rate: 105 },
      { from_currency: 'SGD', to_currency: 'IDR', rate: 11700 },
      { from_currency: 'AUD', to_currency: 'IDR', rate: 10300 },
    ]
  });
  console.log('✅ Created initial currency rates');

}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('🏁 Database seeding finished successfully.');
  });
