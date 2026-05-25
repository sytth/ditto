"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*', // MVP 開發階段允許所有來源
        methods: ['GET', 'POST'],
    },
});
exports.io = io;
const db_1 = __importDefault(require("./db"));
exports.prisma = db_1.default;
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const musicRoutes_1 = __importDefault(require("./routes/musicRoutes"));
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// 註冊 API 路由
app.use('/api/users', userRoutes_1.default);
app.use('/api/music', musicRoutes_1.default);
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
