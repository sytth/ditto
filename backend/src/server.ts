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

app.set('io', io);

import prisma from './db';
import userRoutes from './routes/userRoutes';
import musicRoutes from './routes/musicRoutes';
import matchRoutes from './routes/matchRoutes';
import chatRoutes from './routes/chatRoutes';

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// 註冊 API 路由
app.use('/api/users', userRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/chats', chatRoutes);

// 基礎健康檢查路由
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Ditto Backend is running' });
});

// Render 預設根目錄健康檢查
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Ditto Backend Root is running' });
});

// Socket.io 即時通訊事件處理
io.on('connection', (socket) => {
  console.log(`使用者已連線: ${socket.id}`);

  // 加入聊天室房間
  socket.on('join_room', ({ matchId }) => {
    socket.join(matchId);
    console.log(`使用者 ${socket.id} 加入房間 ${matchId}`);
  });

  // 發出共聽邀請
  socket.on('co_play:invite', (data) => {
    socket.to(data.matchId).emit('co_play:invite', data);
  });

  // 接受共聽邀請
  socket.on('co_play:accept', (data) => {
    const serverStartTime = Date.now() + 2000; // 延遲 2 秒作為兩端緩衝
    io.to(data.matchId).emit('co_play:start', {
      song: data.song,
      serverStartTime,
    });
  });

  // 斷線處理
  socket.on('disconnect', () => {
    console.log(`使用者已斷線: ${socket.id}`);
  });
});

server.listen(PORT as number, '0.0.0.0', () => {
  console.log(`伺服器正在 port ${PORT} 上運行...`);
});
export { prisma, io };
