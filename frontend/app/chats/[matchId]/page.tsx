'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { format } from 'date-fns';
import styles from './chat.module.css';
import { API_URL } from '../../config';

interface User {
  id: string;
  name: string;
  avatar: string | null;
  cards?: { songs: any }[];
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  sender?: User;
}

interface Match {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  expiresAt: string;
  members: { user: User }[];
  decisions?: { userId: string, keep: boolean }[];
}

interface SongItem {
  trackId: string;
  trackName: string;
  artistName: string;
  previewUrl: string;
  coverUrl: string;
  trackViewUrl?: string;
}

export default function ChatRoom({ params }: { params: Promise<{ matchId: string }> }) {
  const router = useRouter();
  const { matchId } = use(params);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [hasDecided, setHasDecided] = useState(false);

  const [showCoplayModal, setShowCoplayModal] = useState(false);
  const [recommendedSongs, setRecommendedSongs] = useState<SongItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SongItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [inviteData, setInviteData] = useState<{ inviterId: string, song: SongItem } | null>(null);
  const [playingSong, setPlayingSong] = useState<SongItem | null>(null);
  const [playProgress, setPlayProgress] = useState(0);
  const [playStatus, setPlayStatus] = useState<'playing'|'ended'|'stopped'>('stopped');
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/onboarding');
      return;
    }
    const user = JSON.parse(userStr);
    setCurrentUser(user);

    fetchChatHistory(user.id);
    setupSocket();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!match || match.status !== 'PENDING') return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(match.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setRemainingTime('00:00:00');
        setIsExpired(true);
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
        const s = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
        setRemainingTime(`${h}:${m}:${s}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [match]);

  const fetchChatHistory = async (uid: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chats/${matchId}/messages`);
      if (!res.ok) throw new Error('無法載入聊天室');
      
      const data = await res.json();
      setMatch(data);
      setMessages(data.messages || []);
      
      const other = data.members.find((m: any) => m.user.id !== uid)?.user;
      if (other) setOtherUser(other);
      
      if (data.status === 'ARCHIVED' || new Date(data.expiresAt).getTime() <= new Date().getTime()) {
        setIsExpired(true);
      }

      if (data.decisions) {
        const myDecision = data.decisions.find((d: any) => d.userId === uid);
        if (myDecision) setHasDecided(true);
      }

      // Extract recommended songs from cards
      const songs: SongItem[] = [];
      data.members.forEach((m: any) => {
        if (m.user.cards && m.user.cards.length > 0) {
          const cardSongs = typeof m.user.cards[0].songs === 'string' 
            ? JSON.parse(m.user.cards[0].songs) 
            : m.user.cards[0].songs;
          songs.push(...cardSongs);
        }
      });
      setRecommendedSongs(songs);

    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupSocket = () => {
    const socket = io(API_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_room', { matchId });
    });

    socket.on('receive_message', (msg: Message) => {
      setMessages((prev) => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('match_unlocked', () => {
      setMatch(prev => prev ? { ...prev, status: 'ACTIVE' } : null);
    });

    socket.on('match_archived', () => {
      setMatch(prev => prev ? { ...prev, status: 'ARCHIVED' } : null);
    });

    socket.on('co_play:invite', (data) => {
      setInviteData({ inviterId: data.inviterId, song: data.song });
    });

    socket.on('co_play:start', (data) => {
      setInviteData(null);
      setPlayingSong(data.song);
      setIsPlayerMinimized(false);
      setPlayStatus('playing');
      
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      
      const audio = audioRef.current;
      audio.src = data.song.previewUrl;
      audio.load();

      const serverStartTime = data.serverStartTime;
      
      const checkAndPlay = () => {
        const delay = Date.now() - serverStartTime;
        if (delay < 0) {
          setTimeout(() => {
            audio.play().catch(console.error);
          }, Math.abs(delay));
        } else if (delay < 30000) {
          audio.currentTime = delay / 1000;
          audio.play().catch(console.error);
        }
      };

      checkAndPlay();

      audio.ontimeupdate = () => {
        setPlayProgress(audio.currentTime);
      };
      audio.onended = () => {
        setPlayStatus('ended');
      };
    });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || (isExpired && match?.status !== 'ACTIVE')) return;

    const content = newMessage.trim();
    setNewMessage(''); 

    try {
      await fetch(`${API_URL}/api/chats/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, content }),
      });
    } catch (err: any) {
      console.error(err);
      alert('發送失敗');
    }
  };

  const handleDecision = async (keep: boolean) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_URL}/api/matches/${matchId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, keep }),
      });
      if (res.ok) setHasDecided(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearchMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`${API_URL}/api/music/search?term=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const sendInvite = (song: SongItem) => {
    if (!currentUser || !socketRef.current) return;
    socketRef.current.emit('co_play:invite', { matchId, inviterId: currentUser.id, song });
    setShowCoplayModal(false);
    alert('已發送共聽邀請！');
  };

  const acceptInvite = () => {
    if (!socketRef.current || !inviteData) return;
    socketRef.current.emit('co_play:accept', { matchId, song: inviteData.song });
  };

  if (loading) return <div className={styles.container} style={{ alignItems: 'center' }}>載入中...</div>;
  if (error) return <div className={styles.container} style={{ alignItems: 'center' }}>{error}</div>;

  const showDecisionPanel = isExpired && match?.status === 'PENDING';

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <button className={styles.backBtn} onClick={() => router.push('/chats')}>←</button>
            <div className={styles.avatar}>
              {otherUser?.name.charAt(0).toUpperCase() || '?'}
            </div>
            <div className={styles.nameInfo}>
              <div className={styles.name}>{otherUser?.name}</div>
              <div className={styles.status}>在線</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {match?.status !== 'ARCHIVED' && (
              <button className={styles.coplayBtn} onClick={() => setShowCoplayModal(true)}>
                🎧 邀請共聽
              </button>
            )}
            <div className={match?.status !== 'PENDING' ? styles.timerArchived : styles.timer}>
              {match?.status === 'ACTIVE' ? '永久解鎖' : match?.status === 'ARCHIVED' ? '已結束' : remainingTime}
            </div>
          </div>
        </header>

        {/* Invite Banner */}
        {inviteData && (
          <div className={styles.inviteBanner}>
            <div className={styles.inviteInfo}>
              對方邀請共聽 <b>{inviteData.song.trackName}</b>
            </div>
            <div className={styles.inviteActions}>
              <button className={styles.acceptBtn} onClick={acceptInvite}>接受</button>
              <button className={styles.rejectBtn} onClick={() => setInviteData(null)}>拒絕</button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className={styles.messageContainer}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser?.id;
            return (
              <div key={msg.id} className={`${styles.messageWrapper} ${isMine ? styles.mine : styles.theirs}`}>
                <div className={styles.messageBubble}>{msg.content}</div>
                <div className={styles.time}>{format(new Date(msg.createdAt), 'HH:mm')}</div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Playback Banner */}
        {playingSong && (
          isPlayerMinimized ? (
            <div className={styles.minimizedPlayer} onClick={() => setIsPlayerMinimized(false)}>
              <div className={styles.musicBars}>
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
                <span className={styles.bar}></span>
              </div>
            </div>
          ) : (
            <div className={styles.playerBanner}>
              <div className={styles.playerDragBar} onClick={() => setIsPlayerMinimized(true)}>
                <div className={styles.dragHandle}></div>
              </div>
              <div className={styles.playerTop}>
                <img src={playingSong.coverUrl} className={styles.playerCover} alt="cover" />
                <div className={styles.playerInfo}>
                  <div className={styles.playerStatus}>
                    {playStatus === 'ended' ? '▶ 共聽已結束' : `▶ 同步共聽中 (${Math.floor(playProgress)}s / 30s)`}
                  </div>
                  <div className={styles.songName}>{playingSong.trackName}</div>
                  <div className={styles.songArtist}>{playingSong.artistName}</div>
                </div>
                <button className={styles.rejectBtn} onClick={() => {
                  if (audioRef.current) audioRef.current.pause();
                  setPlayingSong(null);
                  setPlayStatus('stopped');
                }}>關閉</button>
              </div>
              
              <div className={styles.externalLinks}>
                <div className={styles.extLinksTitle}>聆聽完整歌曲</div>
                <div className={styles.extLinksRow}>
                  <a href={`https://music.youtube.com/search?q=${encodeURIComponent(playingSong.artistName + ' ' + playingSong.trackName)}`} target="_blank" className={styles.extLink}>YouTube Music</a>
                  <a href={`https://open.spotify.com/search/${encodeURIComponent(playingSong.artistName + ' ' + playingSong.trackName)}`} target="_blank" className={styles.extLink}>Spotify</a>
                  <a href={playingSong.trackViewUrl ? playingSong.trackViewUrl : `https://geo.music.apple.com/search?term=${encodeURIComponent(playingSong.artistName + ' ' + playingSong.trackName)}`} target="_blank" className={styles.extLink}>Apple Music</a>
                </div>
              </div>
            </div>
          )
        )}

        {/* Input Area or Decision UI */}
        {showDecisionPanel ? (
          hasDecided ? (
            <div className={styles.decisionWaiting}>等待對方決定中...</div>
          ) : (
            <div className={styles.decisionPanel}>
              <button className={styles.decisionBtnKeep} onClick={() => handleDecision(true)}>保留對話</button>
              <button className={styles.decisionBtnEnd} onClick={() => handleDecision(false)}>結束關係</button>
            </div>
          )
        ) : (
          <form className={styles.inputArea} onSubmit={handleSendMessage}>
            <input
              type="text"
              className={styles.input}
              placeholder={match?.status === 'ARCHIVED' ? "聊天室已鎖定" : "輸入訊息..."}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={match?.status === 'ARCHIVED'}
            />
            <button type="submit" className={styles.sendBtn} disabled={match?.status === 'ARCHIVED' || !newMessage.trim()}>
              <div className={styles.sendIcon}></div>
            </button>
          </form>
        )}

      </div>

      {/* Co-play Modal */}
      {showCoplayModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCoplayModal(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>選擇共聽歌曲</h2>
              <button className={styles.closeBtn} onClick={() => setShowCoplayModal(false)}>×</button>
            </div>
            
            <form onSubmit={handleSearchMusic} style={{ display: 'flex', gap: '10px' }}>
              <input 
                className={styles.searchBar} 
                placeholder="搜尋任何歌曲..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className={styles.acceptBtn} style={{ marginBottom: '15px' }}>搜尋</button>
            </form>

            <div className={styles.songList}>
              {isSearching && <div style={{textAlign: 'center', color: '#94a3b8'}}>搜尋中...</div>}
              
              {(searchResults.length > 0 ? searchResults : recommendedSongs).map((song, idx) => (
                <div key={`${song.trackId}-${idx}`} className={styles.songItem} onClick={() => sendInvite(song)}>
                  <img src={song.coverUrl} className={styles.songCover} alt="cover" />
                  <div className={styles.songInfo}>
                    <div className={styles.songName}>{song.trackName}</div>
                    <div className={styles.songArtist}>{song.artistName}</div>
                  </div>
                </div>
              ))}
              
              {!isSearching && searchResults.length === 0 && recommendedSongs.length === 0 && (
                <div style={{textAlign: 'center', color: '#94a3b8'}}>無推薦歌曲</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
