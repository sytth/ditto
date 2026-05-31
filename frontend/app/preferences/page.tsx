'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../onboarding/onboarding.module.css'; // 共用 onboarding 的樣式
import { API_URL } from '../config';

// 預設曲風選項列表
const PRESET_GENRES = [
  '獨立搖滾', '流行音樂', '爵士樂', 
  '電子音樂', '嘻哈/饒舌', 'City Pop', 
  '民謠/鄉村', 'R&B/靈魂', '重金屬/搖滾'
];

export default function Preferences() {
  const router = useRouter();
  
  // 表單狀態
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [artistInput, setArtistInput] = useState('');
  const [artists, setArtists] = useState<string[]>([]);
  
  // 用戶與介面狀態
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 檢查是否有登入資訊
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/onboarding');
      return;
    }
    const user = JSON.parse(userStr);
    setUserId(user.id);
    setUserName(user.name);
    
    // 如果使用者已經有喜好，就預先載入
    if (user.genres && user.genres.length > 0) {
      setSelectedGenres(user.genres);
    }
    if (user.artists && user.artists.length > 0) {
      setArtists(user.artists);
    }
  }, [router]);

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

  // 提交喜好設定
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedGenres.length === 0) {
      setError('請至少選擇一種喜愛的音樂曲風');
      return;
    }

    if (!userId) return;

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genres: selectedGenres,
          artists: artists,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '儲存喜好失敗');
      }

      const updatedUser = await response.json();

      // 更新 LocalStorage 中的用戶資訊
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));

      // 檢查是否已有今日卡片，有的話回首頁，沒有的話去建立卡片
      try {
        const cardRes = await fetch(`${API_URL}/api/music/music-cards/current?userId=${updatedUser.id}`);
        if (cardRes.ok) {
          router.push('/');
          return;
        }
      } catch (checkErr) {
        console.error('檢查卡片狀態失敗:', checkErr);
      }

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
          <p className={styles.subtitle}>歡迎 {userName}！請告訴我們你的音樂品味</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.card} style={{ padding: 0, background: 'none', border: 'none', boxShadow: 'none', backdropFilter: 'none' }}>
          
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
            {loading ? '儲存中...' : '儲存，下一步選取代表歌單'}
          </button>
        </form>
      </div>
    </div>
  );
}
