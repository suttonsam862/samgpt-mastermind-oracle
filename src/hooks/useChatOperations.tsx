
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
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? {
              ...msg, 
              content: response,
              isLoading: false,
              documents
            } 
          : msg
      ));
    } catch (error) {
      console.error("Error generating response:", error);
      // Handle error case
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? {
              ...msg, 
              content: "Sorry, I encountered an error processing your request. Please try again.",
              isLoading: false
            } 
          : msg
      ));
    } finally {
      setIsProcessing(false);
    }
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
