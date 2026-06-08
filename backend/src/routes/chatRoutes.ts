import { Router } from 'express';
import prisma from '../db';

const router = Router();

// 取得使用者的配對列表 (收件匣)
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // 取得該用戶參與的所有配對
    const matches = await prisma.match.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // 只取最新的一筆作為最後訊息預覽
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // 整理成前端需要的格式，提取出對方的資訊
    const formattedMatches = matches.map((match) => {
      const otherMember = match.members.find((m) => m.userId !== userId)?.user;
      return {
        id: match.id,
        status: match.status,
        expiresAt: match.expiresAt,
        otherUser: otherMember || null,
        lastMessage: match.messages[0] || null,
        unreadCount: 0, // 暫不實作未讀計數，MVP 保持簡單
      };
    });

    return res.status(200).json(formattedMatches);
  } catch (error: any) {
    console.error('獲取配對列表出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// 取得特定聊天室的歷史訊息與狀態
router.get('/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        decisions: true,
        members: {
          include: {
            user: {
              select: { 
                id: true, 
                name: true, 
                avatar: true,
                location: true,
                age: true,
                zodiac: true,
                bio: true,
                genres: true,
                artists: true,
                cards: {
                  where: { isCurrent: true },
                }
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
      },
    });

    if (!match) {
      return res.status(404).json({ error: '找不到該聊天室' });
    }

    return res.status(200).json(match);
  } catch (error: any) {
    console.error('獲取聊天室紀錄出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// 傳送新訊息
router.post('/:matchId/messages', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { senderId, content } = req.body;

    if (!senderId || !content) {
      return res.status(400).json({ error: '必須提供 senderId 與 content' });
    }

    // 檢查聊天室狀態與是否過期
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      return res.status(404).json({ error: '找不到該聊天室' });
    }

    if (match.status === 'ARCHIVED') {
      return res.status(403).json({ error: '聊天室已封存，無法傳送訊息' });
    }

    // 檢查 48 小時過期鎖定
    if (match.status === 'PENDING' && new Date() > new Date(match.expiresAt)) {
      // 已經過期，將其狀態更新為 ARCHIVED，並拒絕寫入
      await prisma.match.update({
        where: { id: matchId },
        data: { status: 'ARCHIVED' },
      });
      return res.status(403).json({ error: '48小時已到期，聊天室已鎖定', isExpired: true });
    }

    // 寫入訊息
    const message = await prisma.message.create({
      data: {
        matchId,
        senderId,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // 觸發 Socket.io 廣播
    const io = req.app.get('io');
    if (io) {
      io.to(matchId).emit('receive_message', message);
    }

    // 更新 Match 的 updatedAt，以便排序對話列表
    await prisma.match.update({
      where: { id: matchId },
      data: { updatedAt: new Date() },
    });

    return res.status(201).json(message);
  } catch (error: any) {
    console.error('傳送訊息出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

export default router;
