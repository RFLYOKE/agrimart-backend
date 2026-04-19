import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env';

export interface AuthSocket extends Socket {
  data: {
    user?: {
      id: string;
      role: string;
    }
  }
}

export let io: Server;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Can be restricted in production
      methods: ['GET', 'POST']
    }
  });

  // Middleware autentikasi socket: verifikasi JWT
  io.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }
      
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
      // Attach user payload ke socket.data.user
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  return io;
};
