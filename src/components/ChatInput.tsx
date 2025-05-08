
import React, { useRef } from 'react';
import { Send, Plus } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isProcessing: boolean;
  handleSubmit: () => void;
  handleNewChat: () => void;
  temperature: number;
  webSearch: boolean;
  darkWeb: boolean;
  modelId: string;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  isProcessing,
  handleSubmit,
  handleNewChat,
  temperature,
  webSearch,
  darkWeb,
  modelId,
  inputRef
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="p-4 border-t border-samgpt-lightgray bg-samgpt-darkgray">
      <div className="flex items-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={handleNewChat}
          className="rounded-full border-samgpt-lightgray bg-transparent hover:bg-samgpt-lightgray flex-shrink-0"
        >
          <Plus size={18} />
        </Button>
        
        <div className={cn(
          "relative flex-grow rounded-lg border border-samgpt-lightgray bg-samgpt-dark focus-within:ring-1 focus-within:ring-samgpt-primary/50",
          isProcessing && "opacity-60"
        )}>
          <Textarea
            ref={inputRef}
            placeholder="Ask SamGPT anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            className="min-h-[52px] w-full border-0 bg-transparent p-3 pr-12 focus:ring-0 focus-visible:ring-0 resize-none"
            rows={1}
            style={{ maxHeight: '200px' }}
          />
          <Button
            size="icon"
            disabled={!input.trim() || isProcessing}
            onClick={handleSubmit}
            className={cn(
              "absolute bottom-1.5 right-1.5 h-8 w-8 rounded-full bg-samgpt-primary hover:bg-samgpt-primary/90",
              !input.trim() && "opacity-50 cursor-not-allowed"
            )}
          >
            <Send size={16} className="text-white" />
          </Button>
        </div>
      </div>
      
      <div className="mt-2 px-1 text-xs text-samgpt-text/60 flex justify-between">
        <div>
          {modelId === 'mistral-7b' ? 'Using Mistral 7B' : modelId}
          {webSearch && ' • Web Search'}
          {darkWeb && ' • Dark Web'}
        </div>
        <div>
          Temp: {temperature.toFixed(1)}
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
