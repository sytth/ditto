import { Router } from 'express';
import prisma from '../db';

const router = Router();

// 註冊或更新用戶資料與音樂喜好
router.post('/register', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ error: '必須提供 Email 與姓名' });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
      },
      create: {
        email,
        name,
        genres: [],
        artists: [],
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('用戶註冊出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});


// 更新基本個人檔案 (Step 2)
router.put('/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const { location, age, zodiac, bio } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        location,
        age: age ? parseInt(age, 10) : null,
        zodiac,
        bio,
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('更新個人檔案出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// 更新用戶音樂喜好
router.put('/:userId/preferences', async (req, res) => {
  try {
    const { userId } = req.params;
    const { genres, artists } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        genres: genres || [],
        artists: artists || [],
      },
    });

    return res.status(200).json(user);
  } catch (error: any) {
    console.error('更新音樂喜好出錯:', error);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

export default router;
