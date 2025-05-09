
import { useState, useEffect } from 'react';
import { Chat } from '@/types/chat';
import { toast } from 'sonner';

/**
 * Hook for managing chat persistence (loading/saving to localStorage)
 */
export const useChatPersistence = () => {
  const [chats, setChats] = useState<Chat[]>(() => {
    // Load chats from localStorage if available
    try {
      const savedChats = localStorage.getItem('chats');
      if (savedChats) {
        // Parse dates correctly
        const parsed = JSON.parse(savedChats);
        return parsed.map((chat: any) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
      }
      return [];
    } catch (error) {
      console.error("Error loading chats from localStorage:", error);
      return [];
    }
  });
  
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => {
    // Load current chat ID from localStorage if available
    try {
      const savedCurrentChatId = localStorage.getItem('currentChatId');
      if (savedCurrentChatId && chats.some(chat => chat.id === savedCurrentChatId)) {
        return savedCurrentChatId;
      }
      return null;
    } catch (error) {
      console.error("Error loading current chat ID from localStorage:", error);
      return null;
    }
  });
  
  // Save chats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('chats', JSON.stringify(chats));
    } catch (error) {
      console.error("Error saving chats to localStorage:", error);
      toast.error("Failed to save chat history.");
    }
  }, [chats]);
  
  // Save current chat ID to localStorage whenever it changes
  useEffect(() => {
    try {
      if (currentChatId) {
        localStorage.setItem('currentChatId', currentChatId);
      } else {
        localStorage.removeItem('currentChatId');
      }
    } catch (error) {
      console.error("Error saving current chat ID to localStorage:", error);
    }
  }, [currentChatId]);

  const getCurrentChat = () => {
    if (!currentChatId) return null;
    return chats.find(chat => chat.id === currentChatId) || null;
  };
  
  const deleteChat = (chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      setCurrentChatId(null);
    }
    toast.success("Chat deleted successfully");
  };

  return {
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    getCurrentChat,
    deleteChat
  };
};
