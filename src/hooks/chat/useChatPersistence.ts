
import { useState, useEffect } from 'react';
import { Chat } from '@/types/chat';

/**
 * Hook for managing chat persistence (loading/saving to localStorage)
 */
export const useChatPersistence = () => {
  const [chats, setChats] = useState<Chat[]>(() => {
    // Load chats from localStorage if available
    const savedChats = localStorage.getItem('chats');
    return savedChats ? JSON.parse(savedChats) : [];
  });
  
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    // Load current chat ID from localStorage if available
    const savedCurrentChatId = localStorage.getItem('currentChatId');
    if (savedCurrentChatId && chats.some(chat => chat.id === savedCurrentChatId)) {
      return savedCurrentChatId;
    }
    return null;
  });
  
  // Save chats to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('chats', JSON.stringify(chats));
  }, [chats]);
  
  // Save current chat ID to localStorage whenever it changes
  useEffect(() => {
    if (currentChatId) {
      localStorage.setItem('currentChatId', currentChatId);
    }
  }, [currentChatId]);

  const getCurrentChat = () => {
    if (!currentChatId) return null;
    return chats.find(chat => chat.id === currentChatId) || null;
  };

  return {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    getCurrentChat
  };
};
