import { useCallback } from 'react';
import { Message, Chat } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '@/utils/chatUtils';

/**
 * Hook for managing chat messages and submission
 */
export const useChatMessages = (
  chatState: {
    chats: Chat[];
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    currentChatId: string | null;
    setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  },
  options: {
    temperature: number;
    webSearch: boolean;
    darkWeb: boolean;
    modelId: string;
  },
  executionState: {
    isProcessing: boolean;
    setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
    input: string;
    setInput: React.Dispatch<React.SetStateAction<string>>;
  }
) => {
  const { chats, setChats, currentChatId, setCurrentChatId } = chatState;
  const { temperature, webSearch, darkWeb, modelId } = options;
  const { isProcessing, setIsProcessing, input, setInput } = executionState;

  // Create a new chat
  const handleNewChat = useCallback(() => {
    const newChat: Chat = {
      id: uuidv4(),
      title: null,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    setChats(prev => [...prev, newChat]);
    setCurrentChatId(newChat.id);
    setInput('');
  }, [setChats, setCurrentChatId, setInput]);
  
  // Select an existing chat
  const handleSelectChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId);
    setInput('');
  }, [setCurrentChatId, setInput]);
  
  // Generate a meaningful title from the first user message
  const generateTitle = (content: string) => {
    // Truncate and clean up for title
    let title = content.trim();
    
    // If content contains a question mark, use everything up to the first question mark
    if (title.includes('?')) {
      title = title.split('?')[0] + '?';
    } else {
      // Otherwise use first 30 chars or first sentence, whichever is shorter
      const firstSentence = title.split(/[.!?]/)[0];
      title = firstSentence.length < 30 ? firstSentence : title.substring(0, 30);
    }
    
    // Add ellipsis if we truncated the title
    if (title.length < content.trim().length) {
      title = title.trim() + (title.endsWith('?') ? '' : '...');
    }
    
    return title;
  };
  
  // Submit a message and get a response
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
            title: chat.title || (chat.messages.length === 0 ? generateTitle(input.trim()) : chat.title)
          }
        : chat
    ));
    
    setInput('');
    setIsProcessing(true);
    
    try {
      // Generate response using RAG by default (forceDeepResearch = false)
      const { response, documents } = await generateResponse(
        input.trim(), 
        modelId, 
        temperature, 
        webSearch, 
        darkWeb, 
        false
      );
      
      // Update the assistant message with the response
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
                      documents: documents
                    } 
                  : msg
              )
            }
          : chat
      ));
    } catch (error) {
      console.error("Error during chat:", error);
      // Handle error case
      setChats(prev => prev.map(chat => 
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map(msg => 
                msg.id === assistantMessage.id 
                  ? {
                      ...msg, 
                      content: "Sorry, I encountered an error while processing your request. Please try again.",
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
  }, [input, isProcessing, modelId, temperature, webSearch, darkWeb, currentChatId, handleNewChat, setInput, setIsProcessing, setChats]);

  return {
    handleNewChat,
    handleSelectChat,
    handleSubmit
  };
};
