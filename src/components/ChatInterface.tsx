
import React, { useRef, useEffect } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChatSidebar from './ChatSidebar';

interface ChatInterfaceProps {
  temperature: number;
  webSearch: boolean;
  darkWeb: boolean;
  modelId: string;
  sidebarOpen: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  temperature, 
  webSearch, 
  darkWeb,
  modelId,
  sidebarOpen
}) => {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { 
    messages, 
    chats,
    currentChatId,
    input, 
    setInput, 
    isProcessing, 
    handleNewChat, 
    handleSelectChat,
    handleSubmit 
  } = useChatOperations(temperature, webSearch, darkWeb, modelId);
  
  // Set focus on input when chat changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentChatId]);
  
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

      {/* This is a mobile-only version of sidebar */}
      <div className="md:hidden">
        <ChatSidebar
          chats={chats}
          currentChatId={currentChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          isOpen={sidebarOpen}
          onToggleSidebar={() => {}} // This will be controlled by the parent
        />
      </div>
    </div>
  );
};

export default ChatInterface;
