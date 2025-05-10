import React, { useState, useEffect } from 'react';
import { Shield, Wifi, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTorPyActiveState } from '@/utils/darkWebBridge';
import { getTorLogs } from '@/utils/torNetworkService';
import { 
  Dialog,
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TorNetworkStatusProps {
  onToggle: () => Promise<void>;
  isLoading: boolean;
}

const TorNetworkStatus: React.FC<TorNetworkStatusProps> = ({ 
  onToggle,
  isLoading 
}) => {
  const [isTorActive, setIsTorActive] = useState(() => getTorPyActiveState());
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // Keep local state in sync with global TorPy state
  useEffect(() => {
    const intervalId = setInterval(() => {
      const globalState = getTorPyActiveState();
      if (isTorActive !== globalState) {
        setIsTorActive(globalState);
      }
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [isTorActive]);
  
  const handleShowLogs = async () => {
    setShowLogs(true);
    setIsLoadingLogs(true);
    
    try {
      const torLogs = await getTorLogs();
      setLogs(torLogs);
    } catch (error) {
      console.error("Error fetching Tor logs:", error);
      setLogs(["Error fetching logs. Tor service may be unavailable."]);
    } finally {
      setIsLoadingLogs(false);
    }
  };
  
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`gap-2 px-4 py-2 shadow-sm ${
          isTorActive 
            ? "bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300" 
            : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
        }`}
        onClick={onToggle}
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <div className="flex items-center gap-2 animate-pulse">
              <Shield className="h-4 w-4" />
              <span>Connecting...</span>
            </div>
          </>
        ) : (
          <>
            {isTorActive ? (
              <div className="flex items-center gap-1">
                <Wifi className="h-4 w-4 text-purple-700" />
                <span className="mr-1">TorPy</span>
                <span className="text-xs bg-purple-200 text-purple-900 px-1.5 py-0.5 rounded-full">Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span className="mr-1">TorPy</span>
                <span className="text-xs opacity-75">(Real Tor)</span>
              </div>
            )}
          </>
        )}
      </Button>
      
      {isTorActive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleShowLogs}
        >
          <Terminal className="h-4 w-4" />
        </Button>
      )}
      
      <Dialog open={showLogs} onOpenChange={setShowLogs}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Tor Network Logs</DialogTitle>
            <DialogDescription>
              Real-time logs from the Tor network connection
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[300px] border rounded p-4 text-xs font-mono">
            {isLoadingLogs ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-pulse">Loading logs...</div>
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div key={index} className="text-green-600">
                    {log}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500">No logs available</div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TorNetworkStatus;
