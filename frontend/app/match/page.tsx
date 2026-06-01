'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudio } from '../components/AudioProvider';
import styles from './match.module.css';
import { API_URL } from '../config';

interface Song {
  trackId: string;
  trackName: string;
  artistName: string;
  previewUrl: string;
  coverUrl: string;
}

interface RecommendedUser {
  id: string;
  name: string;
  avatar: string | null;
  genres: string[];
  artists: string[];
  currentCard: {
    id: string;
    cardName: string;
    songs: Song[];
  };
  vibeScore: number;
}

export default function MatchLobby() {
  const router = useRouter();
  const { isPlaying, currentTrackUrl, playTrack, pauseTrack } = useAudio();

  // 當前用戶狀態
  const [userId, setUserId] = useState<string | null>(null);
  
  // 推薦名單狀態
  const [recommendations, setRecommendations] = useState<RecommendedUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // UI 與載入狀態
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swiping, setSwiping] = useState<'LIKE' | 'SKIP' | null>(null);
  
  // 配對成功 Overlay 狀態
  const [showMatchOverlay, setShowMatchOverlay] = useState(false);
  const [matchedUser, setMatchedUser] = useState<RecommendedUser | null>(null);
  const [createdMatchId, setCreatedMatchId] = useState<string | null>(null);

  // 登入狀態檢查
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/onboarding');
      return;
    }
    const user = JSON.parse(userStr);
    setUserId(user.id);
    fetchRecommendations(user.id);
  }, [router]);

  // 獲取後端推薦對象列表
  const fetchRecommendations = async (uid: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/matches/recommendations?userId=${uid}`);
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '無法載入推薦對象');
      }
      
      const data = await res.json();
      setRecommendations(data);
      setCurrentIndex(0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '連線伺服器出錯，請確認後端已啟動。');
    } finally {
      setLoading(false);
    }
  };

  // 執行滑卡 API
  const handleSwipe = async (action: 'LIKE' | 'SKIP') => {
    if (!userId || recommendations.length === 0 || currentIndex >= recommendations.length) return;
    
    // 停止當前正在預聽的音樂
    pauseTrack();

    const targetUser = recommendations[currentIndex];
    setSwiping(action);

    try {
      // 呼叫後端滑卡 API
      const res = await fetch(`${API_URL}/api/matches/swipe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          targetUserId: targetUser.id,
          action,
        }),
      });

      if (!res.ok) {
        throw new Error('滑動儲存失敗');
      }

      const result = await res.json();

      // 等待動畫播放完畢後移到下一張卡片
      setTimeout(() => {
        setSwiping(null);
        
        if (result.matched) {
          // 配對成功！彈出成功特效視窗
          setMatchedUser(targetUser);
          setCreatedMatchId(result.matchId);
          setShowMatchOverlay(true);
        }
        
        // 移至下一個推薦對象
        setCurrentIndex((prev) => prev + 1);
      }, 400);

    } catch (err: any) {
      console.error(err);
      alert('操作失敗，請重新整理頁面');
      setSwiping(null);
    }
  };

  // 返回大廳首頁
  const handleGoBack = () => {
    pauseTrack();
    router.push('/');
  };

  // 前往聊天室 (第五階段實作)
  const handleGoToChat = () => {
    setShowMatchOverlay(false);
    router.push(`/chats/${createdMatchId}`);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>正在尋找與您頻率相合的品味...</div>
      </div>
    );
  }

  // 檢查是否還有推薦卡片
  const hasCardsLeft = currentIndex < recommendations.length;
  const currentCandidate = hasCardsLeft ? recommendations[currentIndex] : null;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* 頂部標題列 */}
        <header className={styles.header}>
          <div className={styles.logo} onClick={handleGoBack}>Ditto</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className={styles.backBtn} onClick={() => router.push('/chats')}>
              收件匣
            </button>
            <button className={styles.backBtn} onClick={handleGoBack}>
              返回大廳
            </button>
          </div>
        </header>

        {error ? (
          <div className={styles.emptyState}>
            <p style={{ color: '#ef4444' }}>{error}</p>
            <button className={styles.backBtn} onClick={() => window.location.reload()}>
              重新整理
            </button>
          </div>
        ) : !hasCardsLeft ? (
          // 今日推薦滑完狀態
          <div className={styles.emptyState}>
            <p className={styles.emptyText}>今日推薦的音樂同好已經滑完囉！</p>
            <p className={styles.emptyText} style={{ fontSize: '0.85rem', color: '#64748b' }}>
              您可以嘗試重新建立今日音樂卡片，或明日再次前來探索。
            </p>
            <button className={styles.backBtn} onClick={handleGoBack}>
              回大廳首頁
            </button>
          </div>
        ) : (
          // 卡片本體
          currentCandidate && (
            <>
              <div className={styles.cardContainer}>
                <motion.div 
                  key={currentCandidate.id}
                  className={styles.card}
                  initial={{ scale: 0.8, opacity: 0, y: 50 }}
                  animate={{ 
                    scale: swiping ? 0.9 : 1, 
                    opacity: swiping ? 0 : 1, 
                    x: swiping === 'LIKE' ? 300 : swiping === 'SKIP' ? -300 : 0,
                    rotate: swiping === 'LIKE' ? 25 : swiping === 'SKIP' ? -25 : 0,
                    y: 0 
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  {/* 契合度徽章 (無 Emoji) */}
                  <div className={styles.scoreBadge}>
                    契合度 {currentCandidate.vibeScore}%
                  </div>

                  {/* 對象基本資訊 */}
                  <div className={styles.cardHeader}>
                    <h2 className={styles.name}>{currentCandidate.name}</h2>
                    <div className={styles.cardName}>
                      今日卡片：{currentCandidate.currentCard.cardName}
                    </div>
                  </div>

                  {/* 5首代表歌列表 */}
                  <div className={styles.songList}>
                    {currentCandidate.currentCard.songs.map((song) => {
                      const isCurrentPlaying = isPlaying && currentTrackUrl === song.previewUrl;
                      
                      return (
                        <div key={song.trackId} className={styles.songItem}>
                          
                          {/* 專輯封面點擊預聽 */}
                          <div 
                            className={`${styles.coverWrapper} ${isCurrentPlaying ? styles.coverWrapperActive : ''}`}
                            onClick={() => playTrack(song.previewUrl)}
                          >
                            {song.coverUrl && (
                              <img src={song.coverUrl} alt="cover" className={styles.cover} />
                            )}
                            <div className={styles.playOverlay}>
                              {isCurrentPlaying ? (
                                <div className={styles.pauseIcon}></div>
                              ) : (
                                <div className={styles.playIcon}></div>
                              )}
                            </div>
                          </div>

                          {/* 歌曲與歌手名稱 */}
                          <div className={styles.songInfo}>
                            <div className={styles.songName}>{song.trackName}</div>
                            <div className={styles.artistName}>{song.artistName}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 愛好曲風標籤 */}
                  <div className={styles.tagGroup}>
                    {currentCandidate.genres.slice(0, 3).map((g) => (
                      <span key={g} className={styles.badge}>{g}</span>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* 滑卡操作按鈕 (自製 CSS 圖示，無 Emoji) */}
              <div className={styles.actionContainer}>
                <button 
                  className={`${styles.actionBtn} ${styles.skipBtn}`} 
                  onClick={() => handleSwipe('SKIP')}
                  title="跳過"
                >
                  <div className={styles.skipIcon}></div>
                </button>
                <button 
                  className={`${styles.actionBtn} ${styles.likeBtn}`} 
                  onClick={() => handleSwipe('LIKE')}
                  title="喜歡"
                >
                  <div className={styles.likeIcon}></div>
                </button>
              </div>
            </>
          )
        )}
      </div>

      {/* 配對成功全螢幕彈窗 Overlay */}
      <AnimatePresence>
        {showMatchOverlay && matchedUser && (
          <motion.div 
            className={styles.matchOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className={styles.matchSuccessCard}
              initial={{ scale: 0.5, y: 100, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', bounce: 0.6 }}
            >
              <h2 className={styles.matchTitle}>品味契合！</h2>
              <p className={styles.matchSubtitle}>
                您與 {matchedUser.name} 都對彼此的今日音樂卡片表示了喜歡。<br />
                開啟一段 48 小時的限時品味對話吧！
              </p>
              <button className={styles.matchBtn} onClick={handleGoToChat}>
                進入聊天室
              </button>
              <button className={styles.closeMatchBtn} onClick={() => setShowMatchOverlay(false)}>
                繼續尋找同好
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
