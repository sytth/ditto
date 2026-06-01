import { Router } from 'express';
import prisma from '../db';

const router = Router();

// 計算曲風 Jaccard 相似係數
function calculateGenreScore(genresA: string[], genresB: string[]): number {
  if (genresA.length === 0 || genresB.length === 0) return 0;
  
  const setA = new Set(genresA);
  const setB = new Set(genresB);
  
  // 交集
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  // 聯集
  const union = new Set([...setA, ...setB]);
  
  return intersection.size / union.size;
}

// 計算歌手重合度 (交集歌手數 / 3，最高為 1.0)
function calculateArtistScore(artistsA: string[], artistsB: string[]): number {
  if (artistsA.length === 0 || artistsB.length === 0) return 0;
  
  const setB = new Set(artistsB.map(a => a.toLowerCase().trim()));
  const intersection = artistsA.filter(a => setB.has(a.toLowerCase().trim()));
  
  return Math.min(1.0, intersection.length / 3);
}

// 計算今日卡片歌曲重合度 (交集歌曲 trackId 數 / 5)
interface SongItem {
  trackId: string;
  trackName?: string;
  artistName?: string;
  previewUrl?: string;
  coverUrl?: string;
}

function calculateSongScore(songsA: SongItem[], songsB: SongItem[]): number {
  if (songsA.length === 0 || songsB.length === 0) return 0;
  
  const idsB = new Set(songsB.map(s => s.trackId));
  const intersection = songsA.filter(s => idsB.has(s.trackId));
  
  return intersection.length / 5;
}

/**
 * 1. 獲取推薦配對名單 (GET /api/matches/recommendations)
 * 參數: userId=當前用戶ID
 */
router.get('/recommendations', async (req, res) => {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: '必須提供當前用戶 userId' });
  }

  try {
    // 獲取當前用戶 A 的資料與現行音樂卡片
    const userA = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        cards: {
          where: { isCurrent: true }
        }
      }
    });

    if (!userA) {
      return res.status(404).json({ error: '找不到該用戶' });
    }

    const currentCardA = userA.cards[0];
    if (!currentCardA) {
      return res.status(400).json({ error: '您必須先配置今日音樂卡片，才能進行配對推薦' });
    }

    const songsA = typeof currentCardA.songs === 'string'
      ? JSON.parse(currentCardA.songs) as SongItem[]
      : (currentCardA.songs as any) as SongItem[];

    // 取得當前用戶 A 已經滑過 (LIKE/SKIP) 的目標用戶 ID 列表
    const swipedRecords = await prisma.swipe.findMany({
      where: { userId },
      select: { targetUserId: true }
    });
    const swipedTargetIds = swipedRecords.map(r => r.targetUserId);

    // 獲取其他所有已設定今日音樂卡片、且 A 尚未滑過的活躍用戶
    const otherUsers = await prisma.user.findMany({
      where: {
        id: {
          not: userId,
          notIn: swipedTargetIds
        },
        cards: {
          some: { isCurrent: true }
        }
      },
      include: {
        cards: {
          where: { isCurrent: true }
        }
      }
    });

    // 計算每個候選人的 Vibe Score 契合度
    const scoredCandidates = otherUsers.map(userB => {
      const currentCardB = userB.cards[0];
      const songsB = typeof currentCardB.songs === 'string'
        ? JSON.parse(currentCardB.songs) as SongItem[]
        : (currentCardB.songs as any) as SongItem[];

      // 1. 曲風得分 (50%)
      const genreScore = calculateGenreScore(userA.genres, userB.genres);
      // 2. 歌手得分 (30%)
      const artistScore = calculateArtistScore(userA.artists, userB.artists);
      // 3. 歌曲得分 (20%)
      const songScore = calculateSongScore(songsA, songsB);

      // 加權綜合計算 (0 ~ 100 分)
      const totalScore = Math.round((genreScore * 0.5 + artistScore * 0.3 + songScore * 0.2) * 100);

      return {
        id: userB.id,
        name: userB.name,
        avatar: userB.avatar,
        genres: userB.genres,
        artists: userB.artists,
        currentCard: {
          id: currentCardB.id,
          cardName: currentCardB.cardName,
          songs: songsB
        },
        vibeScore: totalScore
      };
    });

    // 由契合度分數高至低排序
    scoredCandidates.sort((a, b) => b.vibeScore - a.vibeScore);

    // 取前 5 名作為推薦名單
    const recommendations = scoredCandidates.slice(0, 5);

    return res.json(recommendations);
  } catch (err: any) {
    console.error('取得配對推薦出錯:', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * 2. 提交滑卡操作 (POST /api/matches/swipe)
 * Body: { userId, targetUserId, action: "LIKE" | "SKIP" }
 */
router.post('/swipe', async (req, res) => {
  const { userId, targetUserId, action } = req.body;

  if (!userId || !targetUserId || !action) {
    return res.status(400).json({ error: '缺少必要欄位：userId, targetUserId 或 action' });
  }

  if (action !== 'LIKE' && action !== 'SKIP') {
    return res.status(400).json({ error: '滑卡動作必須為 LIKE 或 SKIP' });
  }

  try {
    // 儲存或更新當前用戶的滑卡選擇
    await prisma.swipe.upsert({
      where: {
        userId_targetUserId: {
          userId,
          targetUserId
        }
      },
      update: { action },
      create: {
        userId,
        targetUserId,
        action
      }
    });

    // 如果是 LIKE，檢查對方是否也對自己投過 LIKE
    if (action === 'LIKE') {
      const oppositeSwipe = await prisma.swipe.findUnique({
        where: {
          userId_targetUserId: {
            userId: targetUserId,
            targetUserId: userId
          }
        }
      });

      if (oppositeSwipe && oppositeSwipe.action === 'LIKE') {
        // 配對成功！建立 PENDING 房間，到期時間為 48 小時後
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        const match = await prisma.match.create({
          data: {
            status: 'PENDING',
            expiresAt,
            members: {
              create: [
                { userId },
                { userId: targetUserId }
              ]
            }
          }
        });

        return res.json({ matched: true, matchId: match.id });
      }
    }

    return res.json({ matched: false });
  } catch (err: any) {
    console.error('滑卡處理出錯:', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

/**
 * 3. 雙盲結算提交 (POST /api/matches/:matchId/decision)
 * Body: { userId, keep: boolean }
 */
router.post('/:matchId/decision', async (req, res) => {
  const { matchId } = req.params;
  const { userId, keep } = req.body;

  if (!userId || typeof keep !== 'boolean') {
    return res.status(400).json({ error: '必須提供 userId 與 keep(boolean)' });
  }

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        decisions: true
      }
    });

    if (!match) return res.status(404).json({ error: '找不到配對紀錄' });

    // 儲存決定
    await prisma.matchDecision.upsert({
      where: {
        matchId_userId: { matchId, userId }
      },
      update: { keep },
      create: { matchId, userId, keep }
    });

    // 重新取得最新決定列表
    const updatedDecisions = await prisma.matchDecision.findMany({
      where: { matchId }
    });

    let newStatus = match.status;

    // 判斷是否雙方都已經提交
    if (updatedDecisions.length === 2) {
      const allKeep = updatedDecisions.every(d => d.keep === true);
      
      if (allKeep) {
        newStatus = 'ACTIVE';
        await prisma.match.update({
          where: { id: matchId },
          data: { status: 'ACTIVE' }
        });
        const io = req.app.get('io');
        if (io) io.to(matchId).emit('match_unlocked', { matchId });
      } else {
        newStatus = 'ARCHIVED';
        await prisma.match.update({
          where: { id: matchId },
          data: { status: 'ARCHIVED' }
        });
        const io = req.app.get('io');
        if (io) io.to(matchId).emit('match_archived', { matchId });
      }
    }

    return res.json({ status: newStatus });
  } catch (err: any) {
    console.error('提交決定出錯:', err);
    return res.status(500).json({ error: '伺服器錯誤' });
  }
});

export default router;
