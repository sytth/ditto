"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = __importDefault(require("../db"));
const router = (0, express_1.Router)();
// 註冊或更新用戶資料與音樂喜好
router.post('/register', async (req, res) => {
    try {
        const { email, name, genres, artists } = req.body;
        if (!email || !name) {
            return res.status(400).json({ error: '必須提供 Email 與姓名' });
        }
        const user = await db_1.default.user.upsert({
            where: { email },
            update: {
                name,
                genres: genres || [],
                artists: artists || [],
            },
            create: {
                email,
                name,
                genres: genres || [],
                artists: artists || [],
            },
        });
        return res.status(200).json(user);
    }
    catch (error) {
        console.error('用戶註冊出錯:', error);
        return res.status(500).json({ error: '伺服器內部錯誤' });
    }
});
exports.default = router;
