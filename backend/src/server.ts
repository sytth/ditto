import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // MVP 開發階段允許所有來源
    methods: ['GET', 'POST'],
  },
});

import prisma from './db';
import userRoutes from './routes/userRoutes';
import musicRoutes from './routes/musicRoutes';

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 註冊 API 路由
app.use('/api/users', userRoutes);
app.use('/api/music', musicRoutes);

// 基礎健康檢查路由
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ditto Backend is running' });
});

// Socket.io 即時通訊事件處理
io.on('connection', (socket) => {
  console.log(`使用者已連線: ${socket.id}`);

  // 加入聊天室房間
  socket.on('join_room', ({ matchId }) => {
    socket.join(matchId);
    console.log(`使用者 ${socket.id} 加入房間 ${matchId}`);
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log(`使用者已斷線: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`伺服器正在 port ${PORT} 上運行...`);
});
export { prisma, io };
