
import React, { useRef, useEffect, useState } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChatSidebar from './ChatSidebar';
import { Button } from '@/components/ui/button';
import { Book } from 'lucide-react';

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
  const [isResearching, setIsResearching] = useState(false);
  const { 
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
  } = useChatOperations(temperature, webSearch, darkWeb, modelId);
  
  // Set focus on input when chat changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [currentChatId]);
  
  const onDeepResearch = async () => {
    if (!input.trim() || isProcessing || isResearching) return;
    
    setIsResearching(true);
    await handleDeepResearch();
    setIsResearching(false);
  };
  
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      {messages.length === 0 ? (
        <WelcomeScreen setInput={setInput} inputRef={inputRef} />
      ) : (
        <MessageList messages={messages} />
      )}
      
      {/* Input area with Research button */}
      <div className="flex flex-col">
        <div className="flex justify-center mb-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
            onClick={onDeepResearch}
            disabled={!input.trim() || isProcessing || isResearching}
          >
            {isResearching ? (
              <>
                <span className="animate-bounce mr-1">📚</span>
                <span className="relative">
                  <Book className="h-4 w-4 animate-pulse" />
                  <span className="absolute top-0 left-0 h-4 w-4 animate-ping opacity-75">
                    <Book className="h-4 w-4" />
                  </span>
                </span>
                Researching...
              </>
            ) : (
              <>
                <Book className="h-4 w-4" />
                Deep Research
              </>
            )}
          </Button>
        </div>
        
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
