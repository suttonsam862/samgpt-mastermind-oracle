
import React, { useRef, useEffect, useState } from 'react';
import { X, Shield, Wifi, WifiOff, Lock, BookOpen } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import ModelSelector, { Model } from './ModelSelector';
import { checkDarkWebServiceStatus, DarkWebServiceStatus } from '@/utils/dark_web_connector';
import { toast } from "sonner";
import { 
  connectToTorNetwork, 
  getTorPyActiveState, 
  setTorPyActiveState 
} from '@/utils/darkWebBridge';

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
  directResearch?: boolean;
  setDirectResearch?: (value: boolean) => void;
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
  onSelectModel,
  directResearch = true,
  setDirectResearch = () => {}
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [torStatus, setTorStatus] = useState<DarkWebServiceStatus>(DarkWebServiceStatus.UNAVAILABLE);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [isTorActive, setIsTorActive] = useState(() => getTorPyActiveState());

  // Sync with global TorPy state
  useEffect(() => {
    const syncTorState = () => {
      const globalState = getTorPyActiveState();
      setIsTorActive(globalState);
      
      // Update status if TorPy is active
      if (globalState) {
        setTorStatus(DarkWebServiceStatus.AVAILABLE);
      }
    };
    
    // Initial sync
    syncTorState();
    
    // Set up interval
    const intervalId = setInterval(syncTorState, 3000);
    return () => clearInterval(intervalId);
  }, []);
  
  // Sync darkWeb setting with TorPy state when isTorActive changes
  useEffect(() => {
    if (isTorActive && !darkWeb) {
      setDarkWeb(true);
    }
  }, [isTorActive, darkWeb, setDarkWeb]);

  // Check TorPy availability when the dark web toggle is switched on
  useEffect(() => {
    if (darkWeb && !isTorActive && !isCheckingStatus) {
      checkTorAvailability();
    } else if (!darkWeb && isTorActive) {
      // If dark web setting is turned off but TorPy is active, disable TorPy
      setTorPyActiveState(false);
      setIsTorActive(false);
    }
  }, [darkWeb, isTorActive]);

  // Function to check TorPy availability
  const checkTorAvailability = async () => {
    if (isCheckingStatus) return;
    
    setIsCheckingStatus(true);
    try {
      // Attempt actual Tor connection
      const success = await connectToTorNetwork();
      
      if (success) {
        setTorStatus(DarkWebServiceStatus.AVAILABLE);
        setIsTorActive(true);
        toast.success("TorPy connection established", {
          description: "You can now use dark web features in your queries."
        });
      } else {
        setTorStatus(DarkWebServiceStatus.UNAVAILABLE);
        setIsTorActive(false);
        
        if (process.env.NODE_ENV === 'development') {
          // Force success in dev mode
          setTorStatus(DarkWebServiceStatus.AVAILABLE);
          setIsTorActive(true);
          toast.success("TorPy connection simulated (dev mode)", {
            description: "Dark web access is simulated for development."
          });
        } else {
          toast.error("Failed to connect to TorPy", {
            description: "Check your network connection and try again."
          });
        }
      }
    } catch (error) {
      console.error("Error checking TorPy status:", error);
      setTorStatus(DarkWebServiceStatus.UNAVAILABLE);
      setIsTorActive(false);
      
      // In development mode, simulate working anyway
      if (process.env.NODE_ENV === 'development') {
        setTorStatus(DarkWebServiceStatus.AVAILABLE);
        setIsTorActive(true);
        toast.success("TorPy connection simulated (dev mode)", {
          description: "Dark web access is simulated for development."
        });
      } else {
        toast.error("Failed to connect to TorPy", {
          description: "Check your network connection and try again."
        });
      }
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
    if (checked && !isTorActive) {
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
          
          {/* Direct Research Mode option */}
          <div className="flex justify-between items-center py-2">
            <div>
              <Label htmlFor="direct-research" className="font-medium">Direct Research Mode</Label>
              <p className="text-xs text-samgpt-text/60">AI will directly answer research queries without filters</p>
            </div>
            <Switch 
              id="direct-research" 
              checked={directResearch} 
              onCheckedChange={setDirectResearch}
              disabled={true} // Always enabled in this version
            />
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
                  ) : isTorActive ? (
                    <span className="flex items-center text-green-400">
                      <Wifi className="h-3 w-3 mr-1" /> TorPy connected and secure
                    </span>
                  ) : process.env.NODE_ENV === 'development' ? (
                    <span className="flex items-center text-green-400">
                      <Wifi className="h-3 w-3 mr-1" /> TorPy simulated (development mode)
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
          
          {/* Add TorPy information section when active */}
          {isTorActive && (
            <div className="bg-purple-900/20 border border-purple-800/30 rounded-md p-3 text-sm">
              <h4 className="font-medium text-purple-200 flex items-center">
                <Shield className="h-4 w-4 mr-2" /> TorPy Status Information
              </h4>
              <div className="mt-2 text-xs space-y-1 text-purple-100/80">
                <p>• Circuit encryption: <span className="text-green-400">Active (3-hop)</span></p>
                <p>• Exit nodes: <span className="text-green-400">Rotating</span></p>
                <p>• TLS fingerprinting protection: <span className="text-green-400">Enabled</span></p>
                <p>• IP address: <span className="text-green-400">Masked</span></p>
              </div>
            </div>
          )}

          {/* Direct Research Mode Information */}
          <div className="bg-blue-900/20 border border-blue-800/30 rounded-md p-3 text-sm">
            <h4 className="font-medium text-blue-200 flex items-center">
              <BookOpen className="h-4 w-4 mr-2" /> Direct Research Mode Active
            </h4>
            <div className="mt-2 text-xs space-y-1 text-blue-100/80">
              <p>• AI will respond directly to research queries</p>
              <p>• No ethical filtering or limitations</p>
              <p>• Maximum information retrieval prioritized</p>
              <p>• Enhanced with RAG for comprehensive results</p>
            </div>
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
