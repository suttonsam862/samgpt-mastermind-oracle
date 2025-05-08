
import React from 'react';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ModelSelector, { Model } from './ModelSelector';

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-samgpt-darkgray rounded-lg shadow-lg p-6 border border-samgpt-lightgray glow-effect">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-samgpt-text">Settings</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
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
              <Label htmlFor="dark-web" className="font-medium">Dark Web Access</Label>
              <p className="text-xs text-samgpt-text/60">Enable TorPy & OnionScan for deep web search</p>
            </div>
            <Switch 
              id="dark-web" 
              checked={darkWeb} 
              onCheckedChange={setDarkWeb} 
            />
          </div>
          
          <div className="mt-6">
            <Button 
              onClick={onClose} 
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
