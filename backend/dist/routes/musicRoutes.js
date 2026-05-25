"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// 搜尋 iTunes 音樂庫
router.get('/search', async (req, res) => {
    try {
        const { term } = req.query;
        if (!term || typeof term !== 'string') {
            return res.status(400).json({ error: '必須提供搜尋關鍵字 term' });
        }
        const iTunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=20`;
        const response = await fetch(iTunesUrl);
        if (!response.ok) {
            throw new Error(`iTunes API 響應錯誤: ${response.status}`);
        }
        const data = await response.json();
        const results = data.results || [];
        // 過濾並重構回傳資料格式，只保留具有試聽連結的歌曲
        const songs = results
            .filter((item) => item.previewUrl && item.trackId)
            .map((item) => {
            // 將封面轉換為較高畫質 (500x500)
            const coverUrl = item.artworkUrl100
                ? item.artworkUrl100.replace('100x100bb.jpg', '500x500bb.jpg')
                : null;
            return {
                trackId: String(item.trackId),
                trackName: item.trackName,
                artistName: item.artistName,
                previewUrl: item.previewUrl,
                coverUrl,
            };
        });
        return res.status(200).json(songs);
    }
    catch (error) {
        console.error('iTunes 搜尋錯誤:', error);
        return res.status(500).json({ error: '獲取音樂搜尋結果時出錯' });
    }
});
// 建立/儲存音樂卡片 (當日5首代表歌)
router.post('/music-cards', async (req, res) => {
    try {
        const { userId, cardName, songs } = req.body;
        if (!userId || !cardName || !songs || !Array.isArray(songs)) {
            return res.status(400).json({ error: '欄位格式不正確，必須包含 userId、cardName 與 songs 陣列' });
        }
        if (songs.length !== 5) {
            return res.status(400).json({ error: '歌單卡片必須剛好包含 5 首歌曲' });
        }
        // 驗證用戶是否存在
        const userExists = await db_1.default.user.findUnique({
            where: { id: userId },
        });
        if (!userExists) {
            return res.status(404).json({ error: '找不到該用戶' });
        }
        // 使用 Transaction 確保將其他卡片改為非當前生效，並建立新卡片
        const [_, newCard] = await db_1.default.$transaction([
            db_1.default.musicCard.updateMany({
                where: { userId, isCurrent: true },
                data: { isCurrent: false },
            }),
            db_1.default.musicCard.create({
                data: {
                    userId,
                    cardName,
                    songs: songs, // JSON 格式直接儲存
                    isCurrent: true,
                },
            }),
        ]);
        return res.status(201).json(newCard);
    }
    catch (error) {
        console.error('建立音樂卡片失敗:', error);
        return res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
// 獲取使用者當前生效的卡片
router.get('/music-cards/current', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({ error: '必須提供用戶 userId' });
        }
        const currentCard = await db_1.default.musicCard.findFirst({
            where: {
                userId,
                isCurrent: true,
            },
        });
        if (!currentCard) {
            return res.status(404).json({ error: '找不到該用戶當前生效的卡片' });
        }
        return res.status(200).json(currentCard);
    }
    catch (error) {
        console.error('獲取當前卡片失敗:', error);
        return res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
exports.default = router;
