'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';
import { API_URL } from '../config';

export default function Onboarding() {
  const router = useRouter();
  
  // 表單狀態
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // 介面與錯誤狀態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 提交註冊表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('請填寫姓名與 Email');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '註冊失敗');
      }

      const user = await response.json();

      // 將當前登入用戶資訊暫存至 LocalStorage
      localStorage.setItem('currentUser', JSON.stringify(user));

      // 若未設定過喜好（或新用戶），導向至喜好設定頁
      if (!user.genres || user.genres.length === 0) {
        router.push('/preferences');
        return;
      }

      // 檢查是否已有今日卡片
      try {
        const cardRes = await fetch(`${API_URL}/api/music/music-cards/current?userId=${user.id}`);
        if (cardRes.ok) {
          router.push('/');
          return;
        }
      } catch (checkErr) {
        console.error('檢查卡片狀態失敗:', checkErr);
      }

      // 導向建立今日音樂卡片頁面
      router.push('/create-card');
    } catch (err: any) {
      console.error(err);
      setError(err.message || '連線伺服器出錯，請確認後端已啟動。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Ditto</h1>
          <p className={styles.subtitle}>輸入暱稱與信箱，開啟你的音樂旅程</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.card} style={{ padding: 0, background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
          
          {/* 姓名輸入 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>暱稱 / 姓名</label>
            <input
              type="text"
              className={styles.input}
              placeholder="你想被稱呼的名字"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Email 輸入 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>電子郵件 (Email)</label>
            <input
              type="email"
              className={styles.input}
              placeholder="yourname@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '登入中...' : '下一步'}
          </button>
        </form>
      </div>
    </div>
  );
}
