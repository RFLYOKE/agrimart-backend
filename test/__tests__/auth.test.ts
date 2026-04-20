import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/db';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mocking prisma so we don't hit the real DB
jest.mock('../../src/config/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn((callback: any) => callback(prisma)),
  },
}));

describe('Auth Module Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('Berhasil daftar user baru dengan data valid', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'BUYER',
      };

      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue(null);
      (prisma.user.create as jest.Mock<any>).mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          phone: '+6281234567890',
          role: 'BUYER',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('Gagal jika email sudah terdaftar (409)', async () => {
      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({ id: '123', email: 'test@example.com' });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
          phone: '+6281234567890',
          role: 'BUYER',
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Email sudah digunakan|Email already exists/i);
    });

    it('Gagal jika password kurang dari 8 karakter (400 + pesan zod)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test2@example.com',
          password: 'short',
          name: 'Test User',
          phone: '+6281234567890',
          role: 'BUYER',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      // Zod validation error is expected
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('POST /api/auth/login', () => {
    it('Berhasil login + return accessToken dan refreshToken', async () => {
      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        password: '$2b$10$hashedpassword', // Assuming it's mocked or bcrypt is mocked
        role: 'BUYER',
      });

      // We mock bcrypt compare in the module or pass valid hash directly if using real bcrypt
      jest.mock('bcrypt', () => ({
        compare: jest.fn<any>().mockResolvedValue(true)
      }));

      // A simple mock for bcrypt since we don't want to rely on the real execution
      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn<any>().mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
    });

    it('Gagal dengan password salah (401)', async () => {
      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({
        id: '123',
        email: 'test@example.com',
        password: '$2b$10$hashedpassword',
      });

      const bcrypt = require('bcrypt');
      bcrypt.compare = jest.fn<any>().mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('Gagal dengan email tidak terdaftar (404/401)', async () => {
      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'notfound@example.com',
          password: 'Password123!',
        });

      // Depending on implementation it might be 401 or 404
      expect([401, 404]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('Berhasil refresh dengan token valid', async () => {
      // Mock jsonwebtoken
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockReturnValue({ id: '123', role: 'BUYER' });
      jwt.sign = jest.fn().mockReturnValue('new_token');
      
      const redis = require('../../src/config/redis');
      if (redis.redisClient) {
         redis.redisClient.get = jest.fn<any>().mockResolvedValue(null);
      }

      (prisma.user.findUnique as jest.Mock<any>).mockResolvedValue({
        id: '123',
        email: 'test@example.com',
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'valid_refresh_token',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('Gagal dengan token kadaluarsa (401)', async () => {
      const jwt = require('jsonwebtoken');
      jwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'expired_refresh_token',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
