/// <reference types="@prisma/client" />
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

const connectionString = env.DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Prevent multiple instances of Prisma Client in development
declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient({
  adapter,
  log: env.isDevelopment ? ['query', 'info', 'warn', 'error'] : ['error'],
});

if (env.isDevelopment) {
  global.prisma = prisma;
}

export default prisma;
