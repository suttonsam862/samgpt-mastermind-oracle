
import React, { useRef, useEffect, useState } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChatSidebar from './ChatSidebar';
import { Button } from '@/components/ui/button';
import { Book, MessageSquare } from 'lucide-react';

interface ChatInterfaceProps {
  temperature: number;
  webSearch: boolean;
  darkWeb: boolean;
  modelId: string;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  temperature, 
  webSearch, 
  darkWeb,
  modelId,
  sidebarOpen,
  onToggleSidebar
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
    handleDeepResearch,
    handleDeleteChat
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
    <>
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        isOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
      
      <div className={`flex-grow overflow-hidden transition-all duration-300 ${sidebarOpen ? 'md:ml-72' : 'ml-0'} flex flex-col`}>
        {/* Messages area */}
        {messages.length === 0 ? (
          <WelcomeScreen setInput={setInput} inputRef={inputRef} />
        ) : (
          <MessageList messages={messages} />
        )}
        
        {/* Input area with Research button */}
        <div className="flex flex-col">
          <div className="flex justify-center gap-2 mb-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200 px-4 py-2 shadow-sm"
              onClick={onDeepResearch}
              disabled={!input.trim() || isProcessing || isResearching}
            >
              {isResearching ? (
                <>
                  <div className="flex items-center gap-2 animate-pulse">
                    <span className="animate-bounce mr-1">📚</span>
                    <Book className="h-4 w-4" />
                    Researching...
                  </div>
                </>
              ) : (
                <>
                  <Book className="h-4 w-4" />
                  <span className="mr-1">Deep Research</span>
                  <span className="text-xs opacity-75">(Enhanced Knowledge)</span>
                </>
              )}
            </Button>
          </div>
          
          <ChatInput
            input={input}
            setInput={setInput}
            isProcessing={isProcessing || isResearching}
            handleSubmit={handleSubmit}
            handleNewChat={handleNewChat}
            temperature={temperature}
            webSearch={webSearch}
            darkWeb={darkWeb}
            modelId={modelId}
            inputRef={inputRef}
          />
        </div>
      </div>
    </>
  );
};

export default ChatInterface;
