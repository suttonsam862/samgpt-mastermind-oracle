
import React from 'react';
import { Sparkles } from 'lucide-react';

interface WelcomeScreenProps {
  setInput: (input: string) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ setInput, inputRef }) => {
  const suggestions = [
    "Analyze this research paper", 
    "What are the latest AI breakthroughs?",
    "Write me a comprehensive business strategy",
    "Debug this code and optimize it"
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4">
      <Sparkles size={40} className="text-samgpt-primary mb-4" />
      <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-samgpt-primary to-samgpt-secondary bg-clip-text text-transparent">
        SamGPT - The Ultimate Personal AI
      </h2>
      <p className="text-samgpt-text/70 mb-6 max-w-md">
        Your overpowered, overcustomized LLM using Mistral 7B, Haystack, SerpAPI, and more. Ask me anything.
      </p>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
        {suggestions.map((suggestion) => (
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
  );
};

export default WelcomeScreen;
