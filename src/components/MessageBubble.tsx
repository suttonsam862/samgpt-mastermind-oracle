
import React from 'react';
import { Bot, User, Copy, Book, BookOpen, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Document } from '@/utils/haystackUtils';
import { Message } from '@/types/chat';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasDocuments = !isUser && message.documents && message.documents.length > 0;
  const isResearch = message.isResearch;
  const isRAG = message.isRAG;
  
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
          isUser 
            ? "bg-samgpt-primary ml-3" 
            : isRAG 
              ? "bg-purple-500 mr-3" 
              : isResearch 
                ? "bg-amber-500 mr-3" 
                : "bg-samgpt-secondary mr-3"
        )}>
          {isUser ? (
            isResearch || isRAG ? <BookOpen size={16} /> : <User size={16} />
          ) : (
            isRAG ? <Database size={16} /> : isResearch ? <Book size={16} /> : <Bot size={16} />
          )}
        </div>
        
        <div className={cn(
          "py-3 px-4 rounded-lg",
          isUser 
            ? "bg-samgpt-primary text-white" 
            : isRAG
              ? "bg-purple-50 border border-purple-200 text-purple-900"
              : isResearch 
                ? "bg-amber-50 border border-amber-200 text-amber-900" 
                : "bg-samgpt-lightgray",
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
              {isResearch && !isUser && (
                <div className="text-xs uppercase tracking-wider font-semibold mb-2 text-amber-700 flex items-center gap-1">
                  <Book size={12} />
                  Research Results
                </div>
              )}
              
              {isRAG && !isUser && (
                <div className="text-xs uppercase tracking-wider font-semibold mb-2 text-purple-700 flex items-center gap-1">
                  <Database size={12} />
                  RAG Results
                </div>
              )}
              
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {hasDocuments && (
                <div className="mt-3 pt-3 border-t border-samgpt-lightgray/30">
                  <div className="flex items-center gap-2 text-xs text-samgpt-text/70 mb-2">
                    <Book size={14} />
                    <span>Sources</span>
                  </div>
                  <div className="text-xs space-y-2">
                    {message.documents.map((doc, index) => (
                      <div key={doc.id} className="flex items-start gap-2">
                        <span className="font-medium">[{index + 1}]</span>
                        <div>
                          <div className="font-medium">{doc.meta?.title || 'Untitled'}</div>
                          <div className="text-samgpt-text/50">
                            {doc.meta?.source || 'Unknown source'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
