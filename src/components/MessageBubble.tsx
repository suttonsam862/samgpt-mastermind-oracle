
import React from 'react';
import { Bot, User, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
}

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(message.content);
    toast.success("Copied to clipboard");
  };
  
  return (
    <div className={cn(
      "flex w-full mb-4",
      isUser ? "justify-end" : "justify-start"
    )}>
      <div className={cn(
        "flex max-w-[80%]",
        isUser ? "flex-row-reverse" : "flex-row"
      )}>
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isUser ? "bg-samgpt-primary ml-3" : "bg-samgpt-secondary mr-3"
        )}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>
        
        <div className={cn(
          "py-3 px-4 rounded-lg",
          isUser ? "bg-samgpt-primary text-white" : "bg-samgpt-lightgray",
          message.isLoading && "relative overflow-hidden"
        )}>
          {message.isLoading ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          ) : (
            <div className="relative group">
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {!isUser && (
                <div className="absolute right-0 top-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 text-samgpt-text/50 hover:text-samgpt-text hover:bg-samgpt-darkgray"
                    onClick={copyToClipboard}
                  >
                    <Copy size={14} />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
