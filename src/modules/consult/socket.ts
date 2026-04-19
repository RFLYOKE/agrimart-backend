import { Server } from 'socket.io';
import { AuthSocket } from '../../config/socket';
import prisma from '../../config/db';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export const consultSocketHandler = (io: Server) => {
  const consultNamespace = io.of('/consult');

  // Middleware untuk namespace /consult (karena middleware global 'io.use' tidak otomatis cascade ke custom namespace di socket.io)
  consultNamespace.use((socket: AuthSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: Token not provided'));
      
      const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  consultNamespace.on('connection', (socket: AuthSocket) => {
    const user = socket.data.user;

    // Event 'join_session'
    socket.on('join_session', async (sessionId: string) => {
      try {
        const session = await prisma.consultSession.findUnique({
          where: { id: sessionId },
        });

        if (!session) {
          return socket.emit('error', { message: 'Session not found' });
        }

        // Validasi user adalah peserta sesi tersebut
        if (session.user_id !== user?.id && session.consultant_id !== user?.id) {
          return socket.emit('error', { message: 'Unauthorized for this session' });
        }

        socket.join(sessionId);

        // Kirim 50 pesan terakhir saat user join session
        const messages = await prisma.message.findMany({
          where: { session_id: sessionId },
          orderBy: { sent_at: 'desc' },
          take: 50,
        });

        socket.emit('chat_history', messages.reverse());
      } catch (error) {
        console.error(error);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // Event 'send_message'
    socket.on('send_message', async (data: { session_id: string, content: string, type?: 'text'|'image'|'document' }) => {
      try {
        const { session_id, content, type = 'text' } = data;
        
        // Simpan pesan ke database
        const message = await prisma.message.create({
          data: {
            session_id,
            sender_id: user!.id,
            content,
            type: type as any,
          }
        });

        // Broadcast ke room dengan event 'new_message'
        consultNamespace.to(session_id).emit('new_message', message);
      } catch (error) {
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Event 'typing'
    socket.on('typing', (sessionId: string) => {
      // broadcast event 'user_typing' ke room (tanpa simpan ke DB)
      socket.to(sessionId).emit('user_typing', { userId: user?.id });
    });

    // Event 'disconnect'
    socket.on('disconnect', async () => {
      console.log(`User ${user?.id} disconnected from consult namespace`);
      // Update status konsultan jadi offline jika perlu
      // Implementasi spesifik tergantung struktur tabel, contoh bisa pakai Redis untuk track online state
    });
  });
};
