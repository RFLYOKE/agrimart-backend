import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db';
import redisClient from '../../config/redis';
import { env } from '../../config/env';
import { RegisterInput, LoginInput } from './schema';

export class AuthService {
  private generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { id: userId, role },
      env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Register a new user
   */
  async register(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password_hash: hashedPassword,
          phone: data.phone,
          role: data.role as any,
        },
      });

      if (data.role === 'koperasi') {
        await (tx as any).cooperative.create({
          data: {
            user_id: newUser.id,
            name: `${data.name} Cooperative`,
            location: 'Not specified',
            sector: 'pertanian',
            description: null,
            cert_status: 'pending',
          },
        });
      }

      return newUser;
    });

    const tokens = this.generateTokens(user.id, user.role);

    // Save refresh token to redis with 7 days expiration (604800 seconds)
    await redisClient.setEx(`refresh:${user.id}`, 604800, tokens.refreshToken);

    const { password_hash: _, ...userWithoutPassword } = user;
    
    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  /**
   * Login user with email and password
   */
  async login(data: LoginInput) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password_hash || "");

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.generateTokens(user.id, user.role);

    await redisClient.setEx(`refresh:${user.id}`, 604800, tokens.refreshToken);

    const { password_hash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      ...tokens,
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as { id: string };
      
      const storedToken = await redisClient.get(`refresh:${decoded.id}`);
      if (storedToken !== refreshToken) {
        throw new Error('Invalid or expired refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        throw new Error('User not found');
      }

      const accessToken = jwt.sign(
        { id: user.id, role: user.role },
        env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return { accessToken };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await redisClient.del(`refresh:${userId}`);
    return true;
  }
}
