
import { useState, useCallback } from 'react';
import { useChatPersistence } from './chat/useChatPersistence';
import { useChatMessages } from './chat/useChatMessages';
import { useSpecializedQueries } from './chat/useSpecializedQueries';

/**
 * Main hook for chat operations
 * Orchestrates the other specialized hooks
 */
export const useChatOperations = (temperature: number, webSearch: boolean, darkWeb: boolean, modelId: string) => {
  // Input and processing state
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Chat persistence (localStorage)
  const { 
    chats, 
    setChats, 
    currentChatId, 
    setCurrentChatId,
    getCurrentChat,
    deleteChat,
    renameChat
  } = useChatPersistence();
  
  // Basic message operations
  const chatState = { chats, setChats, currentChatId, setCurrentChatId };
  const options = { temperature, webSearch, darkWeb, modelId };
  const executionState = { isProcessing, setIsProcessing, input, setInput };
  
  const { 
    handleNewChat, 
    handleSelectChat, 
    handleSubmit 
  } = useChatMessages(chatState, options, executionState);
  
  // Specialized query operations (deep research)
  const { handleDeepResearch } = useSpecializedQueries(
    { ...chatState, handleNewChat }, 
    options, 
    executionState
  );

  // Delete chat handler
  const handleDeleteChat = useCallback((chatId: string) => {
    deleteChat(chatId);
  }, [deleteChat]);
  
  // Rename chat handler
  const handleRenameChat = useCallback((chatId: string, newTitle: string) => {
    renameChat(chatId, newTitle);
  }, [renameChat]);
  
  // Get current messages
  const messages = getCurrentChat()?.messages || [];

  return {
    messages,
    chats,
    currentChatId,
    input,
    setInput,
    isProcessing,
    handleNewChat,
    handleSelectChat,
    handleSubmit,
    handleDeepResearch,
    handleDeleteChat,
    handleRenameChat
  };
};
