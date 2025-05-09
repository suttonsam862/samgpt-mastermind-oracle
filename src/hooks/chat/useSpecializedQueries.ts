
import { useCallback } from 'react';
import { Message, Chat } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '@/utils/chatUtils';

/**
 * Hook for handling specialized query types like deep research
 */
export const useSpecializedQueries = (
  chatState: {
    chats: Chat[];
    setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
    currentChatId: string | null;
    setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
    handleNewChat: () => void;
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
  const { chats, setChats, currentChatId, handleNewChat } = chatState;
  const { temperature, webSearch, darkWeb, modelId } = options;
  const { isProcessing, setIsProcessing, input, setInput } = executionState;
  
  // Function for deep research
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
      // Generate response with deep research (forceDeepResearch = true)
      const { response, documents } = await generateResponse(
        input.trim(), 
        modelId, 
        temperature, 
        webSearch, 
        darkWeb, 
        true // Force deep research mode
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
  }, [input, isProcessing, modelId, temperature, webSearch, darkWeb, currentChatId, handleNewChat, setInput, setIsProcessing, setChats]);

  return {
    handleDeepResearch
  };
};
