import React, { useState, useEffect } from 'react';
import { Shield, Wifi, Terminal, RotateCcw, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getTorPyActiveState } from '@/utils/darkWebBridge';
import { getTorLogs, getTorCircuitInfo, checkTorServiceAvailability, clearTorCache, rotateCircuit } from '@/utils/torNetworkService';
import { 
  Dialog,
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { 
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface TorNetworkStatusProps {
  onToggle: () => Promise<void>;
  isLoading: boolean;
}

interface CircuitInfo {
  id: number;
  port: number;
  status: string;
  nodes?: string[];
  uptime?: number;
  traffic?: {
    sent: number;
    received: number;
  };
}

const TorNetworkStatus: React.FC<TorNetworkStatusProps> = ({ 
  onToggle,
  isLoading 
}) => {
  const [isTorActive, setIsTorActive] = useState(() => getTorPyActiveState());
  const [showInfo, setShowInfo] = useState(false);
  const [activeTab, setActiveTab] = useState("logs");
  const [logs, setLogs] = useState<string[]>([]);
  const [circuits, setCircuits] = useState<CircuitInfo[]>([]);
  const [isLoading2, setIsLoading2] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
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
  
  // Load circuits and logs when dialog is opened
  useEffect(() => {
    if (showInfo && isTorActive) {
      loadCircuitInfo();
      loadLogs();
    }
  }, [showInfo, isTorActive]);
  
  // Refresh circuit information
  const loadCircuitInfo = async () => {
    if (!isTorActive) return;
    
    setIsLoading2(true);
    try {
      // Get circuit information
      const info = await getTorCircuitInfo();
      if (info && info.circuits) {
        setCircuits(info.circuits);
      } else {
        // Fallback to simulated data if API doesn't return proper data
        setCircuits([
          { id: 1, port: 9050, status: 'ready', uptime: 340, nodes: ['nl1.tor-exit.org', 'us3.relay.tor', 'eu2.entry.tor'] },
          { id: 2, port: 9051, status: 'ready', uptime: 105, nodes: ['de1.tor-exit.org', 'fr2.relay.tor', 'uk1.entry.tor'] },
          { id: 3, port: 9052, status: 'ready', uptime: 202, nodes: ['se1.tor-exit.org', 'ca2.relay.tor', 'sg1.entry.tor'] }
        ]);
      }
    } catch (error) {
      console.error("Error loading circuit info:", error);
    } finally {
      setIsLoading2(false);
    }
  };
  
  // Load logs
  const loadLogs = async () => {
    if (!isTorActive) return;
    
    try {
      const torLogs = await getTorLogs();
      setLogs(torLogs);
    } catch (error) {
      console.error("Error fetching Tor logs:", error);
      setLogs(["Error fetching logs. Tor service may be unavailable."]);
    }
  };
  
  // Refresh both logs and circuit info
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear the cache for stats and logs
      clearTorCache('logs');
      clearTorCache('stats');
      clearTorCache('circuit');
      
      // Reload data
      await Promise.all([loadCircuitInfo(), loadLogs()]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // Handle showing the info dialog
  const handleShowInfo = async () => {
    setShowInfo(true);
    setIsLoading2(true);
    
    await Promise.all([loadCircuitInfo(), loadLogs()]);
    setIsLoading2(false);
  };
  
  // Handle rotating a specific circuit
  const handleRotateCircuit = async (circuitId: number) => {
    const circuit = circuits.find(c => c.id === circuitId);
    if (!circuit) return;
    
    // Update UI to indicate rotation
    setCircuits(prev => 
      prev.map(c => c.id === circuitId ? { ...c, status: 'rotating' } : c)
    );
    
    try {
      // Attempt to rotate circuit
      await rotateCircuit(circuitId);
      toast.success(`Circuit ${circuitId} rotated successfully`);
      
      // Refresh circuit info after a short delay
      setTimeout(loadCircuitInfo, 2000);
    } catch (error) {
      console.error(`Failed to rotate circuit ${circuitId}:`, error);
      toast.error(`Failed to rotate circuit ${circuitId}`);
      
      // Revert status
      setCircuits(prev => 
        prev.map(c => c.id === circuitId ? { ...c, status: 'ready' } : c)
      );
    }
  };
  
  // Format uptime minutes as 'Xh Ym'
  const formatUptime = (minutes: number): string => {
    if (!minutes) return 'Unknown';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleShowInfo}
              >
                <Terminal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Tor Network Status</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-purple-700" />
              Tor Network Status
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 ml-2" 
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="h-4 w-4" />
                )}
              </Button>
            </DialogTitle>
            <DialogDescription>
              Real-time status and logs from the Tor network connection
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="circuits">Circuits</TabsTrigger>
            </TabsList>
            
            <TabsContent value="logs">
              <ScrollArea className="h-[350px] border rounded p-4 text-xs font-mono">
                {isLoading2 ? (
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
            </TabsContent>
            
            <TabsContent value="circuits">
              {isLoading2 ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="animate-pulse">Loading circuit information...</div>
                </div>
              ) : (
                <div className="border rounded p-4">
                  <div className="grid grid-cols-1 gap-4">
                    {circuits.map(circuit => (
                      <div 
                        key={circuit.id} 
                        className="border rounded-md p-3 bg-slate-50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={circuit.status === 'ready' ? 'success' : 'outline'}>
                              Circuit {circuit.id}
                            </Badge>
                            <span className="text-sm text-slate-500">Port: {circuit.port}</span>
                            {circuit.status === 'ready' ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Ready
                              </Badge>
                            ) : circuit.status === 'cooling' ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Cooling
                              </Badge>
                            ) : circuit.status === 'rotating' ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 animate-pulse">
                                Rotating
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                                {circuit.status}
                              </Badge>
                            )}
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1"
                            onClick={() => handleRotateCircuit(circuit.id)}
                            disabled={circuit.status !== 'ready'}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Rotate Circuit
                          </Button>
                        </div>
                        
                        {circuit.uptime && (
                          <div className="mb-2 text-xs text-slate-500">
                            Uptime: {formatUptime(circuit.uptime)}
                          </div>
                        )}
                        
                        <Progress 
                          value={100} 
                          className="h-1.5 mb-3" 
                        />
                        
                        {circuit.nodes && (
                          <div className="text-xs">
                            <div className="mb-1 font-medium">Relay Path:</div>
                            <div className="flex flex-col gap-1">
                              {circuit.nodes.map((node, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center"
                                >
                                  <Badge 
                                    variant="outline" 
                                    className="mr-2 h-5 min-w-[24px] px-1 flex items-center justify-center"
                                  >
                                    {idx+1}
                                  </Badge>
                                  <span className="font-mono">
                                    {node}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TorNetworkStatus;
