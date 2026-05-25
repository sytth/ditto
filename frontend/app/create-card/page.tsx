'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAudio } from '../components/AudioProvider';
import styles from './create-card.module.css';

interface Song {
  trackId: string;
  trackName: string;
  artistName: string;
  previewUrl: string;
  coverUrl: string;
}

export default function CreateCard() {
  const router = useRouter();
  const { isPlaying, currentTrackUrl, playTrack } = useAudio();

  // 用戶與卡片狀態
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [cardName, setCardName] = useState('');
  
  // 搜尋與歌單狀態
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);
  
  // UI 狀態
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 登入狀態檢查 (由 LocalStorage 讀取)
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      // 若未進行 Onboarding 註冊，則強制導向引導頁面
      router.push('/onboarding');
      return;
    }
    const user = JSON.parse(userStr);
    setUserId(user.id);
    setUserName(user.name);
    // 預設卡片名稱為 "暱稱 的今日代表歌"
    setCardName(`${user.name} 的今日代表歌`);
  }, [router]);

  // 音樂搜尋邏輯
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);

    try {
      const res = await fetch(`http://localhost:4000/api/music/search?term=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        throw new Error('搜尋失敗，請稍後再試');
      }
      const data = await res.json();
      setSearchResults(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '無法連線到搜尋伺服器');
    } finally {
      setSearching(false);
    }
  };

  // 加入選中歌曲 (上限 5 首)
  const addSong = (song: Song) => {
    if (selectedSongs.some((s) => s.trackId === song.trackId)) {
      return; // 已加入過則跳過
    }
    if (selectedSongs.length >= 5) {
      setError('今日卡片最多隻能選取 5 首歌曲喔！');
      return;
    }
    setSelectedSongs([...selectedSongs, song]);
    setError(null);
  };

  // 移出選中歌曲
  const removeSong = (songId: string) => {
    setSelectedSongs(selectedSongs.filter((s) => s.trackId !== songId));
  };

  // 提交生成卡片
  const handleSubmitCard = async () => {
    if (!userId) return;
    if (!cardName.trim()) {
      setError('請為您的音樂卡片命名');
      return;
    }
    if (selectedSongs.length !== 5) {
      setError('必須剛好選取 5 首代表歌曲才能生成卡片');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:4000/api/music/music-cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          cardName: cardName.trim(),
          songs: selectedSongs,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '儲存卡片失敗');
      }

      // 儲存成功，開啟成功視窗
      setShowSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '連線伺服器失敗，請重試');
    } finally {
      setSubmitting(false);
    }
  };

  // 進入大廳
  const handleGoToLobby = () => {
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* 頁面標題 */}
        <div className={styles.header}>
          <h1 className={styles.title}>建立您的今日音樂卡片</h1>
          <p className={styles.description}>嗨 {userName}，請搜尋並挑選 5 首最能代表您今天心情或品味的歌曲。</p>
        </div>

        <div className={styles.mainGrid}>
          
          {/* 左欄：搜尋音樂與搜尋結果 */}
          <div className={styles.cardSection}>
            <h2 className={styles.sectionTitle}>搜尋歌曲</h2>
            <form onSubmit={handleSearch} className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="輸入歌名、歌手或關鍵字..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className={styles.searchBtn} disabled={searching}>
                {searching ? '搜尋中...' : '搜尋'}
              </button>
            </form>

            <div className={styles.resultsList}>
              {searchResults.length === 0 ? (
                <div className={styles.emptyState}>
                  {searchQuery ? '沒有找到相符的歌曲，換個關鍵字試試看吧！' : '請在上方搜尋框輸入歌曲關鍵字'}
                </div>
              ) : (
                searchResults.map((song) => {
                  const isCurrentPlaying = isPlaying && currentTrackUrl === song.previewUrl;
                  const isAlreadySelected = selectedSongs.some((s) => s.trackId === song.trackId);

                  return (
                    <div key={song.trackId} className={styles.songItem}>
                      
                      {/* 專輯封面 + 播放點擊 */}
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

                      {/* 加入按鈕 */}
                      <button
                        className={`${styles.actionBtn} ${isAlreadySelected ? styles.actionBtnDisabled : ''}`}
                        onClick={() => addSong(song)}
                        disabled={isAlreadySelected}
                        title={isAlreadySelected ? '已加入今日卡片' : '加入卡片'}
                      >
                        {isAlreadySelected ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右欄：已選歌曲清單與命名存檔 */}
          <div className={styles.cardSection}>
            <h2 className={styles.sectionTitle}>今日選歌 (已選 {selectedSongs.length}/5)</h2>
            
            <div className={styles.selectedList}>
              {selectedSongs.length === 0 ? (
                <div className={styles.emptyState}>
                  尚未選取歌曲，請從左側搜尋並加入。
                </div>
              ) : (
                selectedSongs.map((song, index) => (
                  <div key={song.trackId} className={styles.selectedItem}>
                    <div className={styles.badge}>{index + 1}</div>
                    
                    <div className={styles.songInfo}>
                      <div className={styles.songName} style={{ fontSize: '0.9rem' }}>{song.trackName}</div>
                      <div className={styles.artistName} style={{ fontSize: '0.75rem' }}>{song.artistName}</div>
                    </div>

                    <button 
                      className={styles.actionBtn} 
                      style={{ fontSize: '0.9rem', width: '26px', height: '26px' }}
                      onClick={() => removeSong(song.trackId)}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            {selectedSongs.length > 0 && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />
                
                <div className={styles.formGroup} style={{ gap: '6px' }}>
                  <label className={styles.label} style={{ fontSize: '0.85rem' }}>為這張卡片命名</label>
                  <input
                    type="text"
                    className={styles.cardInput}
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="例如: 深夜微醺 Vibe"
                  />
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <button
                  className={styles.submitBtn}
                  onClick={handleSubmitCard}
                  disabled={submitting || selectedSongs.length !== 5}
                >
                  {submitting ? '卡片生成中...' : '✨ 生成我的音樂卡片'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 成功彈出視窗 */}
      {showSuccess && (
        <div className={styles.successOverlay}>
          <div className={styles.successCard}>
            <div className={styles.successIcon}>🎉</div>
            <h2 className={styles.successTitle}>卡片生成成功！</h2>
            <p className={styles.successText}>
              您的今日音樂卡片「{cardName}」已經發佈至雲端。<br />
              接下來，系統將以這 5 首代表歌與您的曲風喜好，為您配對同頻率的對象！
            </p>
            <button className={styles.successBtn} onClick={handleGoToLobby}>
              進入配對大廳
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
