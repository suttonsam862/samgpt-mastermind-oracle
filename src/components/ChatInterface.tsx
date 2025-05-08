
import React, { useState, useRef, useEffect } from 'react';
import { Send, Plus, Sparkles } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import MessageBubble, { Message } from './MessageBubble';
import { cn } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    // Scroll to the bottom when messages change
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleNewChat = () => {
    setMessages([]);
  };

  const handleSubmit = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };
    
    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsProcessing(true);
    
    // Simulate API call with timeout
    setTimeout(() => {
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessage.id 
          ? {
              ...msg, 
              content: generateResponse(input.trim(), modelId, temperature, webSearch, darkWeb),
              isLoading: false
            } 
          : msg
      ));
      setIsProcessing(false);
    }, 1500);
  };
  
  const generateResponse = (
    prompt: string, 
    model: string, 
    temp: number,
    useWebSearch: boolean,
    useDarkWeb: boolean
  ): string => {
    // This is a placeholder for actual AI response generation
    // In a real implementation, this would call your backend API
    
    // Just a mock response for demo purposes
    const responses = [
      `I've analyzed your request "${prompt}" using ${model} (temperature: ${temp}). ${useWebSearch ? "Web search was used" : "No web search was performed"}. ${useDarkWeb ? "Dark web sources were consulted" : ""}`,
      "Based on Mistral 7B's parameters, I've determined that your query requires a nuanced approach. The most efficient solution would be to implement a recursive algorithm with logarithmic time complexity.",
      "Here's my analysis:\n\n1. Your premise contains three key assumptions\n2. The historical data suggests a different pattern\n3. By applying Haystack's retrieval augmentation, we can synthesize a more accurate model",
      "I've processed your request through multiple evaluation criteria. The primary factors to consider are temporal consistency, logical coherence, and factual accuracy. Let me elaborate on each...",
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-grow overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Sparkles size={40} className="text-samgpt-primary mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-samgpt-primary to-samgpt-secondary bg-clip-text text-transparent">
              SamGPT - The Ultimate Personal AI
            </h2>
            <p className="text-samgpt-text/70 mb-6 max-w-md">
              Your overpowered, overcustomized LLM using Mistral 7B, Haystack, SerpAPI, and more. Ask me anything.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {["Analyze this research paper", 
                "What are the latest AI breakthroughs?",
                "Write me a comprehensive business strategy",
                "Debug this code and optimize it"
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  className="bg-samgpt-darkgray hover:bg-samgpt-lightgray text-left p-3 rounded-lg border border-samgpt-lightgray text-sm transition-all"
                  onClick={() => {
                    setInput(suggestion);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={endOfMessagesRef} />
      </div>
      
      {/* Input area */}
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
    </div>
  );
};

export default ChatInterface;
