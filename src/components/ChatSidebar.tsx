
import React from 'react';
import { MessageSquare, MessageSquarePlus, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Chat } from '@/types/chat';

interface ChatSidebarProps {
  chats: Chat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat?: (chatId: string) => void;
  isOpen: boolean;
  onToggleSidebar: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  isOpen,
  onToggleSidebar
}) => {
  // Sort chats by updatedAt, most recent first
  const sortedChats = [...chats].sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 bg-samgpt-darkgray border-r border-samgpt-lightgray",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-samgpt-lightgray">
        <h2 className="font-medium text-lg">Chat History</h2>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleSidebar}
          className="h-8 w-8"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-3">
        <Button 
          className="w-full flex items-center gap-2 bg-samgpt-primary hover:bg-samgpt-primary/90" 
          onClick={onNewChat}
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>
      
      <ScrollArea className="h-[calc(100vh-120px)] px-3 pb-3">
        {sortedChats.length === 0 ? (
          <div className="text-center text-sm text-samgpt-text/50 p-4">
            No previous chats
          </div>
        ) : (
          <div className="space-y-2">
            {sortedChats.map((chat) => (
              <div key={chat.id} className="relative group">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start text-left font-normal relative truncate pr-8",
                    currentChatId === chat.id && "bg-samgpt-lightgray"
                  )}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate">{chat.title || "New conversation"}</span>
                </Button>
                
                {onDeleteChat && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteChat(chat.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Delete chat</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default ChatSidebar;
