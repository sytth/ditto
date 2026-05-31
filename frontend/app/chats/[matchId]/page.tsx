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
  
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 初始化資料與連線
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
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [matchId]);

  // 2. 自動捲動到最新訊息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. 處理倒數計時
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
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || isExpired) return;

    const content = newMessage.trim();
    setNewMessage(''); // optimistic clear

    try {
      const res = await fetch(`${API_URL}/api/chats/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUser.id,
          content,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.isExpired) {
          setIsExpired(true);
        }
        throw new Error(errorData.error || '發送失敗');
      }
      
      // 訊息會透過 Socket 廣播回來，不需在此手動推入 messages
    } catch (err: any) {
      console.error(err);
      alert(err.message);
    }
  };

  if (loading) return <div className={styles.container} style={{ alignItems: 'center' }}>載入中...</div>;
  if (error) return <div className={styles.container} style={{ alignItems: 'center' }}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerInfo}>
            <button className={styles.backBtn} onClick={() => router.push('/chats')}>
              ←
            </button>
            <div className={styles.avatar}>
              {otherUser?.name.charAt(0).toUpperCase() || '?'}
            </div>
            <div className={styles.nameInfo}>
              <div className={styles.name}>{otherUser?.name}</div>
              <div className={styles.status}>在線</div>
            </div>
          </div>
          
          <div className={isExpired ? styles.timerArchived : styles.timer}>
            {match?.status === 'ACTIVE' 
              ? '永久解鎖' 
              : isExpired 
                ? '已結束' 
                : remainingTime}
          </div>
        </header>

        {/* Messages */}
        <div className={styles.messageContainer}>
          {messages.map((msg) => {
            const isMine = msg.senderId === currentUser?.id;
            return (
              <div key={msg.id} className={`${styles.messageWrapper} ${isMine ? styles.mine : styles.theirs}`}>
                <div className={styles.messageBubble}>
                  {msg.content}
                </div>
                <div className={styles.time}>
                  {format(new Date(msg.createdAt), 'HH:mm')}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Expired Overlay */}
        {isExpired && match?.status !== 'ACTIVE' && (
          <div className={styles.archivedOverlay}>
            48小時限時對話已結束，聊天室已轉為唯讀。
          </div>
        )}

        {/* Input Area */}
        <form className={styles.inputArea} onSubmit={handleSendMessage}>
          <input
            type="text"
            className={styles.input}
            placeholder={isExpired ? "聊天室已鎖定" : "輸入訊息..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isExpired}
          />
          <button 
            type="submit" 
            className={styles.sendBtn}
            disabled={isExpired || !newMessage.trim()}
          >
            <div className={styles.sendIcon}></div>
          </button>
        </form>

      </div>
    </div>
  );
}
