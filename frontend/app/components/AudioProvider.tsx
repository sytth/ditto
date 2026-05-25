'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface AudioContextType {
  isPlaying: boolean;
  currentTrackUrl: string | null;
  playTrack: (url: string) => void;
  pauseTrack: () => void;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackUrl, setCurrentTrackUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 初始化單一全域 Audio 實例
  useEffect(() => {
    audioRef.current = new Audio();

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audioRef.current.addEventListener('ended', handleEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleEnded);
        audioRef.current.pause();
      }
    };
  }, []);

  const playTrack = (url: string) => {
    if (!audioRef.current) return;

    if (currentTrackUrl === url) {
      // 點擊同一首，如果暫停中就播放，播放中就暫停
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch((err) => console.log('音訊播放失敗:', err));
        setIsPlaying(true);
      }
    } else {
      // 播放新歌
      audioRef.current.pause();
      audioRef.current.src = url;
      audioRef.current.load();
      audioRef.current.play().catch((err) => console.log('音訊播放失敗:', err));
      setCurrentTrackUrl(url);
      setIsPlaying(true);
    }
  };

  const pauseTrack = () => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <AudioContext.Provider value={{ isPlaying, currentTrackUrl, playTrack, pauseTrack }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio 必須在 AudioProvider 內部使用');
  }
  return context;
};
