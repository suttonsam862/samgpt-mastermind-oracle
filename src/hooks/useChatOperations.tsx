
import { useState, useCallback } from 'react';
import { Message } from '@/components/MessageBubble';
import { v4 as uuidv4 } from 'uuid';
import { generateResponse } from '@/utils/chatUtils';

export const useChatOperations = (temperature: number, webSearch: boolean, darkWeb: boolean, modelId: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleNewChat = useCallback(() => {
    setMessages([]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isProcessing) return;
    
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
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsProcessing(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? {
              ...msg, 
              content: generateResponse(input.trim(), modelId, temperature, webSearch, darkWeb),
              isLoading: false
            } 
          : msg
      ));
      setIsProcessing(false);
    }, 1500);
  }, [input, isProcessing, modelId, temperature, webSearch, darkWeb]);

  return {
    messages,
    input,
    setInput,
    isProcessing,
    handleNewChat,
    handleSubmit
  };
};
