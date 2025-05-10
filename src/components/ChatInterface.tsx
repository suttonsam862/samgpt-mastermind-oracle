
import React, { useRef, useEffect, useState } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChatSidebar from './ChatSidebar';
import { Button } from '@/components/ui/button';
import { Book, MessageSquare, Edit, Edit2 } from 'lucide-react';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  
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
    handleDeleteChat,
    handleRenameChat
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

  // Get current chat for title editing
  const currentChat = chats.find(chat => chat.id === currentChatId);
  
  // Start edit mode
  const startEditing = () => {
    if (currentChat) {
      setEditedTitle(currentChat.title || "New conversation");
      setIsEditing(true);
    }
  };
  
  // Save edited title
  const saveTitle = () => {
    if (currentChatId && editedTitle.trim()) {
      handleRenameChat(currentChatId, editedTitle.trim());
    }
    setIsEditing(false);
  };
  
  // Handle key down events for title editing
  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };
  
  return (
    <>
      <ChatSidebar
        chats={chats}
        currentChatId={currentChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        isOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
      />
      
      <div className={`flex-grow overflow-hidden transition-all duration-300 ${sidebarOpen ? 'md:ml-72' : 'ml-0'} flex flex-col`}>
        {/* Chat title area (only shown for existing chats) */}
        {currentChatId && messages.length > 0 && (
          <div className="flex items-center justify-center p-2 border-b border-samgpt-lightgray">
            {isEditing ? (
              <div className="flex items-center">
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={handleTitleKeyDown}
                  className="bg-samgpt-dark border border-samgpt-lightgray rounded px-2 py-1 text-samgpt-text focus:outline-none focus:ring-1 focus:ring-samgpt-primary"
                  autoFocus
                  maxLength={50}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveTitle}
                  className="ml-2"
                >
                  Save
                </Button>
              </div>
            ) : (
              <div className="flex items-center">
                <h2 className="text-samgpt-text font-medium truncate max-w-[200px] md:max-w-[400px]">
                  {currentChat?.title || "New conversation"}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={startEditing}
                  className="ml-2 h-7 w-7"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        
        {/* Messages area */}
        {messages.length === 0 ? (
          <WelcomeScreen setInput={setInput} inputRef={inputRef} />
        ) : (
          <MessageList messages={messages} />
        )}
        
        {/* Input area with Research buttons */}
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
