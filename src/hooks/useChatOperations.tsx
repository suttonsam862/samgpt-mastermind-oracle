
import { useState, useCallback, useEffect } from 'react';
import { Message } from '@/components/MessageBubble';
import { Chat } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '@/utils/chatUtils';
import { processWithHaystack } from '@/utils/haystackUtils';

export const useChatOperations = (temperature: number, webSearch: boolean, darkWeb: boolean, modelId: string) => {
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
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
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
  
  const getCurrentChat = useCallback(() => {
    if (!currentChatId) return null;
    return chats.find(chat => chat.id === currentChatId) || null;
  }, [chats, currentChatId]);
  
  const messages = getCurrentChat()?.messages || [];
  
  const handleNewChat = useCallback(() => {
    const newChatId = uuidv4();
    const newChat: Chat = {
      id: newChatId,
      title: null,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setChats(prev => [...prev, newChat]);
    setCurrentChatId(newChatId);
  }, []);
  
  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
  }, []);
  
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    // Create a new chat if there's no current chat
    if (!currentChatId) {
      handleNewChat();
    }
    
    const chatId = currentChatId || uuidv4();
    
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    
    // Update the chat with these messages
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? {
            ...chat,
            messages: [...chat.messages, userMessage, assistantMessage],
            updatedAt: new Date(),
            // Set chat title based on first user message if not already set
            title: chat.title || (chat.messages.length === 0 ? input.trim().slice(0, 30) : chat.title)
          }
        : chat
    ));
    
    setInput('');
    setIsProcessing(true);
    
    try {
      // Generate response with potential document retrieval
      const { response, documents } = await generateResponse(
        input.trim(), 
        modelId, 
        temperature, 
        webSearch, 
        darkWeb
      );
      
      // Update the assistant message with the response and any retrieved documents
      setChats(prev => prev.map(chat => 
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === assistantMessage.id 
                  ? {
                      ...msg, 
                      content: response,
                      isLoading: false,
                      documents
                    } 
                  : msg
              )
            }
          : chat
      ));
    } catch (error) {
      console.error("Error generating response:", error);
      // Handle error case
      setChats(prev => prev.map(chat => 
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === assistantMessage.id 
                  ? {
                      ...msg, 
                      content: "Sorry, I encountered an error processing your request. Please try again.",
                      isLoading: false
                    } 
                  : msg
              )
            }
          : chat
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, modelId, temperature, webSearch, darkWeb, currentChatId, handleNewChat]);

  // New function for deep research
  const handleDeepResearch = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
    // Create a new chat if there's no current chat
    if (!currentChatId) {
      handleNewChat();
    }
    
    const chatId = currentChatId || uuidv4();
    
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      isResearch: true
    };
    
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
      isResearch: true
    };
    
    // Update the chat with these messages
    setChats(prev => prev.map(chat => 
      chat.id === chatId 
        ? {
            ...chat,
            messages: [...chat.messages, userMessage, assistantMessage],
            updatedAt: new Date(),
            // Set chat title based on first user message if not already set
            title: chat.title || (chat.messages.length === 0 ? input.trim().slice(0, 30) : chat.title)
          }
        : chat
    ));
    
    setInput('');
    setIsProcessing(true);
    
    try {
      // Use Haystack directly for deep research
      const { response, documents } = await processWithHaystack(
        input.trim(),
        modelId,
        temperature,
        webSearch,
        darkWeb
      );
      
      // Update the assistant message with the research response and any retrieved documents
      setChats(prev => prev.map(chat => 
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === assistantMessage.id 
                  ? {
                      ...msg, 
                      content: response,
                      isLoading: false,
                      documents,
                      isResearch: true
                    } 
                  : msg
              )
            }
          : chat
      ));
    } catch (error) {
      console.error("Error during deep research:", error);
      // Handle error case
      setChats(prev => prev.map(chat => 
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === assistantMessage.id 
                  ? {
                      ...msg, 
                      content: "Sorry, I encountered an error while researching your query. Please try again.",
                      isLoading: false,
                      isResearch: true
                    } 
                  : msg
              )
            }
          : chat
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [input, isProcessing, modelId, temperature, webSearch, darkWeb, currentChatId, handleNewChat]);

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
    handleDeepResearch
  };
};
