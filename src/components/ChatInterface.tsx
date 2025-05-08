
import React, { useRef } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';

interface ChatInterfaceProps {
  temperature: number;
  webSearch: boolean;
  darkWeb: boolean;
  modelId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  temperature, 
  webSearch, 
  darkWeb,
  modelId
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { 
    messages, 
    input, 
    setInput, 
    isProcessing, 
    handleNewChat, 
    handleSubmit 
  } = useChatOperations(temperature, webSearch, darkWeb, modelId);
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      {messages.length === 0 ? (
        <WelcomeScreen setInput={setInput} inputRef={inputRef} />
      ) : (
        <MessageList messages={messages} />
      )}
      
      {/* Input area */}
      <ChatInput
        input={input}
        setInput={setInput}
        isProcessing={isProcessing}
        handleSubmit={handleSubmit}
        handleNewChat={handleNewChat}
        temperature={temperature}
        webSearch={webSearch}
        darkWeb={darkWeb}
        modelId={modelId}
        inputRef={inputRef}
      />
    </div>
  );
};

export default ChatInterface;
