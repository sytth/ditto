'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAudio } from './components/AudioProvider';
import styles from './page.module.css';

interface Song {
  trackId: string;
  trackName: string;
  artistName: string;
  previewUrl: string;
  coverUrl: string;
}

interface MusicCard {
  id: string;
  cardName: string;
  songs: Song[];
  createdAt: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  genres: string[];
  artists: string[];
}

export default function Home() {
  const router = useRouter();
  const { isPlaying, currentTrackUrl, playTrack, pauseTrack } = useAudio();

  const [user, setUser] = useState<User | null>(null);
  const [currentCard, setCurrentCard] = useState<MusicCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. 檢查 LocalStorage 是否有登入用戶
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/onboarding');
      return;
    }

    const currentUser = JSON.parse(userStr);
    setUser(currentUser);

    // 2. 獲取當前用戶生效的今日卡片
    const fetchCurrentCard = async () => {
      try {
        const res = await fetch(`http://localhost:4000/api/music/music-cards/current?userId=${currentUser.id}`);
        
        if (res.status === 404) {
          // 沒有當前卡片，導向建立卡片頁
          router.push('/create-card');
          return;
        }

        if (!res.ok) {
          throw new Error('無法取得音樂卡片資料');
        }

        const cardData = await res.json();
        
        // 解析 Prisma 回傳的 Json 格式 songs
        const songs = typeof cardData.songs === 'string' 
          ? JSON.parse(cardData.songs) 
          : cardData.songs;

        setCurrentCard({
          ...cardData,
          songs: songs || []
        });
      } catch (err: any) {
        console.error(err);
        setError('載入卡片失敗，請確認後端服務已啟動。');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentCard();
  }, [router]);

  // 登出邏輯
  const handleLogout = () => {
    pauseTrack();
    localStorage.removeItem('currentUser');
    router.push('/onboarding');
  };

  // 重建今日卡片
  const handleRecreateCard = () => {
    router.push('/create-card');
  };

  // 進入配對頁 (第四階段實作)
  const handleStartMatch = () => {
    alert('配對功能即將於「第四階段：品味推薦與滑動配對」實作，敬請期待！');
  };

  if (loading) {
    return <div className={styles.loading}>載入中...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* 導覽列 */}
        <header className={styles.nav}>
          <div className={styles.logo}>Ditto</div>
          {user && (
            <div className={styles.userInfo}>
              <span className={styles.userName}>👤 {user.name}</span>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                登出
              </button>
            </div>
          )}
        </header>

        {error ? (
          <div className={styles.dashboardCard} style={{ textAlign: 'center', borderColor: '#ef4444' }}>
            <p style={{ color: '#ef4444', marginBottom: '15px' }}>{error}</p>
            <button className={styles.recreateBtn} onClick={() => window.location.reload()}>
              重新整理
            </button>
          </div>
        ) : (
          <main className={styles.dashboard}>
            
            {/* 我的今日音樂卡片 */}
            {currentCard && (
              <div className={styles.dashboardCard}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>🎵 我的今日音樂卡片</h2>
                  <button className={styles.recreateBtn} onClick={handleRecreateCard}>
                    重建今日卡片
                  </button>
                </div>
                
                <h3 style={{ fontSize: '1.1rem', color: '#a78bfa', marginBottom: '20px', fontWeight: 700 }}>
                  🌟 卡片名稱：{currentCard.cardName}
                </h3>

                <div className={styles.songList}>
                  {currentCard.songs.map((song) => {
                    const isCurrentPlaying = isPlaying && currentTrackUrl === song.previewUrl;
                    return (
                      <div key={song.trackId} className={styles.songItem}>
                        
                        {/* 封面播放按鈕 */}
                        <div 
                          className={`${styles.coverWrapper} ${isCurrentPlaying ? styles.coverWrapperActive : ''}`}
                          onClick={() => playTrack(song.previewUrl)}
                        >
                          {song.coverUrl && (
                            <img src={song.coverUrl} alt="cover" className={styles.cover} />
                          )}
                          <div className={styles.playOverlay}>
                            {isCurrentPlaying ? '⏸' : '▶'}
                          </div>
                        </div>

                        {/* 歌曲資訊 */}
                        <div className={styles.songInfo}>
                          <div className={styles.songName}>{song.trackName}</div>
                          <div className={styles.artistName}>{song.artistName}</div>
                        </div>

                        {/* 右側播放提示狀態 */}
                        {isCurrentPlaying && (
                          <div className={styles.statusText}>🎵 播放中...</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 喜好摘要 */}
                {user && (
                  <div className={styles.preferenceSummary}>
                    <div className={styles.tagGroup}>
                      <span className={styles.tagLabel}>喜歡的曲風</span>
                      <div className={styles.tags}>
                        {user.genres.map((g) => (
                          <span key={g} className={styles.badge}>{g}</span>
                        ))}
                      </div>
                    </div>

                    {user.artists.length > 0 && (
                      <div className={styles.tagGroup}>
                        <span className={styles.tagLabel}>最愛的歌手/樂團</span>
                        <div className={styles.tags}>
                          {user.artists.map((a) => (
                            <span key={a} className={styles.badge} style={{ borderColor: 'rgba(167, 139, 250, 0.3)' }}>{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 配對按鈕區 */}
            <div className={styles.lobbyAction}>
              <button className={styles.startMatchBtn} onClick={handleStartMatch}>
                🔥 開始品味配對
              </button>
              <p className={styles.statusText}>今日卡片已發佈，準備好開啟音樂之旅吧！</p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
