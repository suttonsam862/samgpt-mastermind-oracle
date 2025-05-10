import React, { useRef, useEffect, useState } from 'react';
import { useChatOperations } from '@/hooks/useChatOperations';
import WelcomeScreen from './WelcomeScreen';
import ChatInput from './ChatInput';
import MessageList from './MessageList';
import ChatSidebar from './ChatSidebar';
import { Button } from '@/components/ui/button';
import { Book, MessageSquare, Edit, Edit2, Shield, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { checkDarkWebServiceStatus, DarkWebServiceStatus } from '@/utils/dark_web_connector';
import { initDarkWebBridge, setupDarkWebEventListeners } from '@/utils/darkWebBridge';

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
  const [isTorActive, setIsTorActive] = useState(false);
  const [isCheckingTor, setIsCheckingTor] = useState(false);
  const [torInitialized, setTorInitialized] = useState(false);
  
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
  } = useChatOperations(temperature, webSearch, darkWeb || isTorActive, modelId);
  
  // Initialize dark web bridge on component mount
  useEffect(() => {
    const initialize = async () => {
      try {
        // Always attempt to initialize in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log("Development mode: Automatically initializing TorPy simulation");
          setTorInitialized(true);
          setupDarkWebEventListeners();
          
          // If darkWeb is enabled in settings, automatically simulate active status
          if (darkWeb) {
            setIsTorActive(true);
            toast.success("TorPy connection simulated (dev mode)", {
              description: "Dark web access is simulated for development."
            });
          }
          return;
        }
        
        // For production: actually try to connect
        const success = await initDarkWebBridge();
        setTorInitialized(success);
        if (success) {
          setupDarkWebEventListeners();
          // If darkWeb is enabled in settings, automatically check Tor status
          if (darkWeb) {
            checkTorStatus();
          }
        }
      } catch (error) {
        console.error("Error initializing dark web bridge:", error);
        toast.error("Failed to initialize TorPy connection");
        
        // In development, still allow simulated mode
        if (process.env.NODE_ENV === 'development') {
          setTorInitialized(true);
          if (darkWeb) {
            setIsTorActive(true);
          }
        }
      }
    };
    
    initialize();
  }, [darkWeb]);
  
  // Check TorPy status with actual service
  const checkTorStatus = async () => {
    if (isCheckingTor) return;
    
    setIsCheckingTor(true);
    try {
      // In development mode, simulate success
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful TorPy connection");
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network delay
        setIsTorActive(true);
        toast.success("TorPy connection simulated (dev mode)", {
          description: "Dark web access is simulated for development."
        });
        setIsCheckingTor(false);
        return;
      }
      
      // Production mode: actually check status
      const status = await checkDarkWebServiceStatus();
      
      if (status === DarkWebServiceStatus.AVAILABLE) {
        setIsTorActive(true);
        toast.success("TorPy connection established", {
          description: "Dark web access is now enabled for enhanced capabilities."
        });
      } else if (status === DarkWebServiceStatus.RUNNING) {
        setIsTorActive(true);
        toast.success("TorPy is currently running", {
          description: "Dark web operations are in progress."
        });
      } else {
        setIsTorActive(false);
        toast.error("TorPy connection failed", {
          description: "Please check your configuration or try again later."
        });
      }
    } catch (error) {
      console.error("Error checking TorPy status:", error);
      
      // Development mode fallback
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful TorPy connection after error");
        setIsTorActive(true);
        toast.success("TorPy connection simulated (dev mode)", {
          description: "Dark web access is simulated for development."
        });
      } else {
        toast.error("Failed to connect to TorPy service");
        setIsTorActive(false);
      }
    } finally {
      setIsCheckingTor(false);
    }
  };
  
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
            
            {/* TorPy Button with enhanced visual indicator */}
            <Button
              variant="outline"
              size="sm"
              className={`gap-2 px-4 py-2 shadow-sm ${
                isTorActive 
                  ? "bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300" 
                  : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
              }`}
              onClick={checkTorStatus}
              disabled={isCheckingTor}
            >
              {isCheckingTor ? (
                <>
                  <div className="flex items-center gap-2 animate-pulse">
                    <Shield className="h-4 w-4" />
                    <span>Connecting...</span>
                  </div>
                </>
              ) : (
                <>
                  {isTorActive ? (
                    <div className="flex items-center gap-1">
                      <Wifi className="h-4 w-4 text-purple-700" />
                      <span className="mr-1">TorPy</span>
                      <span className="text-xs bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded-full">Active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      <span className="mr-1">TorPy</span>
                      <span className="text-xs opacity-75">(Secure Access)</span>
                    </div>
                  )}
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
            darkWeb={darkWeb || isTorActive}
            modelId={modelId}
            inputRef={inputRef}
          />
        </div>
      </div>
    </>
  );
};

export default ChatInterface;
