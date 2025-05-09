
import React, { useState } from 'react';
import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import ChatSidebar from '@/components/ChatSidebar';
import SettingsPanel from '@/components/SettingsPanel';
import { Model } from '@/components/ModelSelector';
import { Toaster } from "@/components/ui/sonner";
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

const Index = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [webSearch, setWebSearch] = useState(true);
  const [darkWeb, setDarkWeb] = useState(false);
  const [selectedModel, setSelectedModel] = useState('mistral-7b');
  
  const models: Model[] = [
    {
      id: 'mistral-7b',
      name: 'Mistral 7B',
      description: 'Advanced open-source LLM with high efficiency',
      tag: 'default'
    },
    {
      id: 'mistral-haystack',
      name: 'Mistral + Haystack',
      description: 'Enhanced with document retrieval capabilities',
      tag: 'precise'
    },
    {
      id: 'serpapi-enhanced',
      name: 'Web Research Model',
      description: 'Integrated with SerpAPI for real-time web information',
      tag: 'creative'
    },
    {
      id: 'tor-enhanced',
      name: 'Deep Web Model',
      description: 'Access TOR network through OnionScan integration',
      tag: 'fast'
    }
  ];

  return (
    <div className="flex flex-col h-screen bg-samgpt-dark text-samgpt-text">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="ml-2 mr-1"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Header onOpenSettings={() => setSettingsOpen(true)} />
      </div>
      
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(false)}
        chats={[]} // This will be populated by ChatInterface
        currentChatId={null} // This will be set by ChatInterface
        onSelectChat={() => {}} // This will be handled by ChatInterface
        onNewChat={() => {}} // This will be handled by ChatInterface
      />
      
      <div className={`flex-grow overflow-hidden transition-all duration-300 ${sidebarOpen ? 'pl-72' : 'pl-0'}`}>
        <ChatInterface
          temperature={temperature}
          webSearch={webSearch}
          darkWeb={darkWeb}
          modelId={selectedModel}
          sidebarOpen={sidebarOpen}
        />
      </div>
      
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        temperature={temperature}
        setTemperature={setTemperature}
        webSearch={webSearch}
        setWebSearch={setWebSearch}
        darkWeb={darkWeb}
        setDarkWeb={setDarkWeb}
        models={models}
        selectedModel={selectedModel}
        onSelectModel={setSelectedModel}
      />
      
      <Toaster position="bottom-right" />
    </div>
  );
};

export default Index;
