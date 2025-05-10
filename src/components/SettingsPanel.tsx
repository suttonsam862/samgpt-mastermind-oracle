
import React, { useRef, useEffect, useState } from 'react';
import { X, Shield, Wifi, WifiOff, Lock } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ModelSelector, { Model } from './ModelSelector';
import { checkDarkWebServiceStatus, DarkWebServiceStatus } from '@/utils/dark_web_connector';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  temperature: number;
  setTemperature: (value: number) => void;
  webSearch: boolean;
  setWebSearch: (value: boolean) => void;
  darkWeb: boolean;
  setDarkWeb: (value: boolean) => void;
  models: Model[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  temperature,
  setTemperature,
  webSearch,
  setWebSearch,
  darkWeb,
  setDarkWeb,
  models,
  selectedModel,
  onSelectModel
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [torStatus, setTorStatus] = useState<DarkWebServiceStatus>(DarkWebServiceStatus.UNAVAILABLE);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // Check TorPy availability when the dark web toggle is switched on
  useEffect(() => {
    if (darkWeb && !isCheckingStatus) {
      checkTorAvailability();
    }
  }, [darkWeb]);

  // Function to check TorPy availability
  const checkTorAvailability = async () => {
    if (isCheckingStatus) return;
    
    setIsCheckingStatus(true);
    try {
      const status = await checkDarkWebServiceStatus();
      setTorStatus(status);
    } catch (error) {
      console.error("Error checking TorPy status:", error);
      setTorStatus(DarkWebServiceStatus.UNAVAILABLE);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  if (!isOpen) return null;

  // Handler for modal backdrop click - close the panel
  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only close if the backdrop itself is clicked
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle save button click
  const handleSave = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  // Handle close button click
  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };
  
  // Handle dark web toggle with TorPy check
  const handleDarkWebToggle = (checked: boolean) => {
    setDarkWeb(checked);
    if (checked) {
      checkTorAvailability();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
      onClick={handleBackdropClick}
    >
      <div 
        ref={panelRef}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-samgpt-darkgray rounded-lg shadow-lg p-6 border border-samgpt-lightgray glow-effect"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the panel
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-samgpt-text">Settings</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleCloseClick}
            className="hover:bg-samgpt-lightgray"
          >
            <X size={18} />
          </Button>
        </div>
        
        <div className="space-y-6">
          <ModelSelector 
            models={models} 
            selectedModel={selectedModel} 
            onSelectModel={onSelectModel}
          />
          
          <div>
            <label className="block text-sm font-medium mb-2 text-samgpt-text/80">
              Temperature: {temperature.toFixed(1)}
            </label>
            <Slider
              value={[temperature]}
              min={0}
              max={2}
              step={0.1}
              onValueChange={(value) => setTemperature(value[0])}
              className="my-5"
            />
            <div className="flex justify-between text-xs text-samgpt-text/60">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>
          
          <div className="flex justify-between items-center py-2">
            <div>
              <Label htmlFor="web-search" className="font-medium">Web Search</Label>
              <p className="text-xs text-samgpt-text/60">Use SerpAPI to search the web for information</p>
            </div>
            <Switch 
              id="web-search" 
              checked={webSearch} 
              onCheckedChange={setWebSearch} 
            />
          </div>
          
          <div className="flex justify-between items-center py-2">
            <div>
              <Label htmlFor="dark-web" className="font-medium">Dark Web Access (TorPy)</Label>
              <p className="text-xs text-samgpt-text/60">Enable TorPy & OnionScan for deep web search</p>
              {darkWeb && (
                <div className="flex items-center mt-1 text-xs">
                  {isCheckingStatus ? (
                    <span className="flex items-center text-yellow-400">
                      <Lock className="h-3 w-3 mr-1 animate-pulse" /> Checking TorPy status...
                    </span>
                  ) : torStatus === DarkWebServiceStatus.AVAILABLE ? (
                    <span className="flex items-center text-green-400">
                      <Wifi className="h-3 w-3 mr-1" /> TorPy connected and secure
                    </span>
                  ) : torStatus === DarkWebServiceStatus.RUNNING ? (
                    <span className="flex items-center text-blue-400">
                      <Shield className="h-3 w-3 mr-1" /> TorPy operations in progress
                    </span>
                  ) : (
                    <span className="flex items-center text-red-400">
                      <WifiOff className="h-3 w-3 mr-1" /> TorPy unavailable
                    </span>
                  )}
                </div>
              )}
            </div>
            <Switch 
              id="dark-web" 
              checked={darkWeb} 
              onCheckedChange={handleDarkWebToggle} 
            />
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={handleSave} 
              className="w-full bg-gradient-to-r from-samgpt-primary to-samgpt-secondary hover:opacity-90"
            >
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
