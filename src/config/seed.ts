/// <reference types="@prisma/client" />
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting seed...");

  // 1. Create Admin User
  const admin = await prisma.user.upsert({
    where: { email: "admin@agrimart.com" },
    update: {},
    create: {
      role: "admin",
      name: "Admin AgriMart",
      email: "admin@agrimart.com",
      phone: "081234567890",
      password_hash: "$2b$10$xyz", // Placeholder hash
      status: "active",
    },
  });
  console.log(`✅ Created admin user: ${admin.email}`);

  // 2. Create Cooperatives & their Users
  const coopUser1 = await prisma.user.upsert({
    where: { email: "budi@kopjaya.com" },
    update: {},
    create: {
      role: "koperasi",
      name: "Budi - Kopjaya",
      email: "budi@kopjaya.com",
      password_hash: "$2b$10$xyz",
      cooperative: {
        create: {
          name: "Koperasi Maju Jaya",
          location: "Bandung, Jawa Barat",
          description: "Koperasi pertanian sayur organik",
          cert_status: "verified",
          fresh_rate: 4.8,
        },
      },
    },
    include: { cooperative: true },
  });

  const coopUser2 = await prisma.user.upsert({
    where: { email: "siti@kopmakmur.com" },
    update: {},
    create: {
      role: "koperasi",
      name: "Siti - Kopmakmur",
      email: "siti@kopmakmur.com",
      password_hash: "$2b$10$xyz",
      cooperative: {
        create: {
          name: "Koperasi Tani Makmur",
          location: "Malang, Jawa Timur",
          description: "Penghasil buah-buahan segar",
          cert_status: "verified",
          fresh_rate: 4.5,
        },
      },
    },
    include: { cooperative: true },
  });
  console.log(`✅ Created 2 cooperatives`);

  // 3. Create 5 Dummy Products
  const coop1Id = coopUser1.cooperative!.id;
  const coop2Id = coopUser2.cooperative!.id;

  // Clear products to avoid duplicates during repeated seedy
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: [
      {
        coop_id: coop1Id,
        name: "Wortel Organik",
        description: "Wortel segar dari pegunungan",
        price_b2c: 15000,
        price_b2b: 12000,
        stock: 500,
        category: "Sayuran",
        images: ["https://example.com/wortel.jpg"],
        is_active: true,
      },
      {
        coop_id: coop1Id,
        name: "Brokoli Segar",
        description: "Brokoli hijau kaya vitamin",
        price_b2c: 20000,
        price_b2b: 17000,
        stock: 300,
        category: "Sayuran",
        images: ["https://example.com/brokoli.jpg"],
        is_active: true,
      },
      {
        coop_id: coop2Id,
        name: "Apel Malang",
        description: "Apel manalagi asli Malang",
        price_b2c: 25000,
        price_b2b: 22000,
        stock: 1000,
        category: "Buah",
        images: ["https://example.com/apel.jpg"],
        is_active: true,
      },
      {
        coop_id: coop2Id,
        name: "Jeruk Manis",
        description: "Jeruk peras manis",
        price_b2c: 18000,
        price_b2b: 15000,
        stock: 800,
        category: "Buah",
        images: ["https://example.com/jeruk.jpg"],
        is_active: true,
      },
      {
        coop_id: coop1Id,
        name: "Tomat Merah",
        description: "Tomat segar untuk masak atau jus",
        price_b2c: 12000,
        price_b2b: 10000,
        stock: 600,
        category: "Sayuran",
        images: ["https://example.com/tomat.jpg"],
        is_active: true,
      },
    ],
  });
  console.log(`✅ Created 5 dummy products`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("🏁 Seeding finished.");
  });
