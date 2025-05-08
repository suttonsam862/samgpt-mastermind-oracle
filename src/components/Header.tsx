
import React from 'react';
import { Settings, Zap, Database } from 'lucide-react';
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="w-full bg-gradient-to-r from-samgpt-darkgray to-samgpt-dark border-b border-samgpt-lightgray p-4 flex justify-between items-center">
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <Zap size={28} className="text-samgpt-primary animate-pulse-glow" />
          <h1 className="text-2xl font-bold ml-2 bg-gradient-to-r from-samgpt-primary to-samgpt-secondary bg-clip-text text-transparent">
            SamGPT
          </h1>
        </div>
        <span className="text-xs bg-samgpt-primary px-2 py-0.5 rounded-full text-white">
          ALPHA
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-1 text-sm text-samgpt-text/70">
          <Database size={16} className="text-samgpt-secondary" />
          <span>Mistral 7B</span>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onOpenSettings}
          className="hover:bg-samgpt-lightgray text-samgpt-text"
        >
          <Settings size={20} />
        </Button>
      </div>
    </header>
  );
};

export default Header;
