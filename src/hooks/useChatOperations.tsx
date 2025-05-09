
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
    getCurrentChat
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
  
  // Specialized query operations (deep research, RAG)
  const { 
    handleDeepResearch, 
    handleRAGQuery 
  } = useSpecializedQueries(
    { ...chatState, handleNewChat }, 
    options, 
    executionState
  );
  
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
    handleRAGQuery
  };
};
