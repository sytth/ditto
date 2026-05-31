'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './chats.module.css';
import { API_URL } from '../config';

interface User {
  id: string;
  name: string;
  avatar: string | null;
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
}

interface Match {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'ARCHIVED';
  expiresAt: string;
  otherUser: User | null;
  lastMessage: Message | null;
}

export default function ChatsList() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) {
      router.push('/onboarding');
      return;
    }
    const user = JSON.parse(userStr);
    fetchMatches(user.id);
  }, [router]);

  const fetchMatches = async (userId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/chats/${userId}`);
      if (!res.ok) {
        throw new Error('無法載入配對列表');
      }
      const data = await res.json();
      setMatches(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 格式化倒數計時（簡單顯示剩餘小時與分鐘）
  const getRemainingTime = (expiresAt: string) => {
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return '已過期';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `剩餘 ${hours}h ${minutes}m`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        <header className={styles.header}>
          <h1 className={styles.title}>收件匣</h1>
          <button className={styles.backBtn} onClick={() => router.push('/')}>
            回大廳
          </button>
        </header>

        {loading ? (
          <div className={styles.loading}>載入中...</div>
        ) : error ? (
          <div className={styles.errorMsg}>{error}</div>
        ) : matches.length === 0 ? (
          <div className={styles.emptyState}>
            目前還沒有配對成功的聊天室。<br/>
            快去大廳探索，尋找頻率相近的同好吧！
          </div>
        ) : (
          <div className={styles.chatList}>
            {matches.map(match => (
              <div 
                key={match.id} 
                className={styles.chatCard}
                onClick={() => router.push(`/chats/${match.id}`)}
              >
                <div className={styles.chatInfo}>
                  <div className={styles.avatar}>
                    {match.otherUser?.name.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className={styles.details}>
                    <div className={styles.name}>{match.otherUser?.name || '未知使用者'}</div>
                    <div className={styles.lastMessage}>
                      {match.lastMessage ? match.lastMessage.content : '開啟你們的第一段對話吧！'}
                    </div>
                  </div>
                </div>

                <div className={styles.metaInfo}>
                  {match.status === 'PENDING' ? (
                    <div className={styles.countdown}>
                      {getRemainingTime(match.expiresAt)}
                    </div>
                  ) : match.status === 'ARCHIVED' ? (
                    <div className={styles.statusArchived}>已封存</div>
                  ) : (
                    <div className={styles.countdown} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                      永久解鎖
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
