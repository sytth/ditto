'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';
import { API_URL } from '../config';

export default function Onboarding() {
  const router = useRouter();
  
  const [step, setStep] = useState<1 | 2>(1);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 表單狀態 (Step 1)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // 表單狀態 (Step 2)
  const [location, setLocation] = useState('');
  const [age, setAge] = useState('');
  const [zodiac, setZodiac] = useState('');
  const [bio, setBio] = useState('');
  
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
      setCurrentUser(user);
      localStorage.setItem('currentUser', JSON.stringify(user));

      // 檢查是否已填寫過基本資料 (例如 age 或 zodiac)
      if (!user.age && !user.zodiac && !user.location) {
        setStep(2);
        return;
      }

      // 如果已經填寫過，直接檢查後續流程
      checkNextStep(user);

    } catch (err: any) {
      console.error(err);
      setError(err.message || '連線伺服器出錯，請確認後端已啟動。');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/users/${currentUser.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: location.trim(),
          age: age.trim() || undefined,
          zodiac: zodiac.trim(),
          bio: bio.trim(),
        }),
      });

      if (!response.ok) throw new Error('基本資料更新失敗');

      const updatedUser = await response.json();
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      
      checkNextStep(updatedUser);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '更新出錯');
    } finally {
      setLoading(false);
    }
  };

  const checkNextStep = async (user: any) => {
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
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.logo}>Ditto</h1>
          <p className={styles.subtitle}>
            {step === 1 ? '輸入暱稱與信箱，開啟你的音樂旅程' : '填寫基本資料，讓大家更認識你'}
          </p>
        </div>

        {step === 1 ? (
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
        ) : (
          <form onSubmit={handleProfileSubmit} className={styles.card} style={{ padding: 0, background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
            
            {/* 地點輸入 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>居住地點</label>
              <input
                type="text"
                className={styles.input}
                placeholder="例如：台北市, 花蓮"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              {/* 年齡輸入 */}
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>年齡</label>
                <input
                  type="number"
                  className={styles.input}
                  placeholder="例如：22"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  min="18"
                  max="100"
                />
              </div>

              {/* 星座輸入 */}
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label className={styles.label}>星座</label>
                <select 
                  className={styles.input}
                  value={zodiac}
                  onChange={(e) => setZodiac(e.target.value)}
                >
                  <option value="">選擇星座</option>
                  <option value="牡羊座">牡羊座</option>
                  <option value="金牛座">金牛座</option>
                  <option value="雙子座">雙子座</option>
                  <option value="巨蟹座">巨蟹座</option>
                  <option value="獅子座">獅子座</option>
                  <option value="處女座">處女座</option>
                  <option value="天秤座">天秤座</option>
                  <option value="天蠍座">天蠍座</option>
                  <option value="射手座">射手座</option>
                  <option value="摩羯座">摩羯座</option>
                  <option value="水瓶座">水瓶座</option>
                  <option value="雙魚座">雙魚座</option>
                </select>
              </div>
            </div>

            {/* 自我介紹 */}
            <div className={styles.formGroup}>
              <label className={styles.label}>自我介紹 (選填)</label>
              <textarea
                className={styles.input}
                placeholder="說說看你的興趣，或是對音樂的感覺吧！"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                style={{ resize: 'none' }}
              />
            </div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? '儲存中...' : '完成'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
