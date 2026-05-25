'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './onboarding.module.css';

// 預設曲風選項列表
const PRESET_GENRES = [
  '獨立搖滾', '流行音樂', '爵士樂', 
  '電子音樂', '嘻哈/饒舌', 'City Pop', 
  '民謠/鄉村', 'R&B/靈魂', '重金屬/搖滾'
];

export default function Onboarding() {
  const router = useRouter();
  
  // 表單狀態
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState('');
  const [artists, setArtists] = useState<string[]>([]);
  
  // 介面與錯誤狀態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 曲風切換選擇邏輯
  const handleGenreToggle = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  // 歌手 Tag 管理邏輯
  const handleArtistInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = artistInput.trim();
      if (val && !artists.includes(val)) {
        setArtists([...artists, val]);
        setArtistInput('');
      }
    }
  };

  const removeArtist = (artistToRemove: string) => {
    setArtists(artists.filter(a => a !== artistToRemove));
  };

  // 提交註冊表單
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError('請填寫姓名與 Email');
      return;
    }

    if (selectedGenres.length === 0) {
      setError('請至少選擇一種喜愛的音樂曲風');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          genres: selectedGenres,
          artists: artists,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '註冊失敗');
      }

      const user = await response.json();

      // 將當前登入用戶資訊暫存至 LocalStorage
      localStorage.setItem('currentUser', JSON.stringify(user));

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
          <p className={styles.subtitle}>用手動配置的音樂卡片，找到同頻率的靈魂</p>
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

          {/* 曲風多選 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>喜愛的音樂曲風 (可多選)</label>
            <div className={styles.genreGrid}>
              {PRESET_GENRES.map((genre) => {
                const isActive = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    className={`${styles.genreButton} ${isActive ? styles.genreButtonActive : ''}`}
                    onClick={() => handleGenreToggle(genre)}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 歌手/樂團標籤輸入 */}
          <div className={styles.formGroup}>
            <label className={styles.label}>喜愛的歌手 / 樂團</label>
            <div className={styles.tagInputContainer}>
              <input
                type="text"
                className={styles.input}
                placeholder="輸入歌手名稱後按 Enter 新增"
                value={artistInput}
                onChange={(e) => setArtistInput(e.target.value)}
                onKeyDown={handleArtistInputKeyDown}
              />
              {artists.length > 0 && (
                <div className={styles.tagList}>
                  {artists.map((artist) => (
                    <span key={artist} className={styles.tag}>
                      {artist}
                      <button
                        type="button"
                        className={styles.removeTagBtn}
                        onClick={() => removeArtist(artist)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && <div className={styles.errorMsg}>{error}</div>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? '註冊中...' : '儲存，下一步選取代表歌單'}
          </button>
        </form>
      </div>
    </div>
  );
}
