import React, { useState, useEffect } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import { Spinner } from "./ui/spinner";
import { toast } from "sonner";
import { 
  ingestOnionUrls, 
  ingestOnionUrlsFromFile, 
  checkDarkWebServiceStatus, 
  getDarkWebServiceLogs,
  discoverAndIngestOnionUrls,
  DarkWebServiceStatus,
  DarkWebIngestionResult,
  DarkWebDiscoveryResult
} from "../utils/dark_web_connector";

const DarkWebIngestionPanel: React.FC = () => {
  const [urls, setUrls] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [serviceStatus, setServiceStatus] = useState<DarkWebServiceStatus>(DarkWebServiceStatus.UNAVAILABLE);
  const [processing, setProcessing] = useState<boolean>(false);
  const [result, setResult] = useState<DarkWebIngestionResult | null>(null);
  const [activeTab, setActiveTab] = useState<string>('urls');
  const [searchQueries, setSearchQueries] = useState<string>('');
  const [discoveryLimit, setDiscoveryLimit] = useState<number>(20);

  // Check service status on component mount
  useEffect(() => {
    const checkStatus = async () => {
      const status = await checkDarkWebServiceStatus();
      setServiceStatus(status);
      if (status === DarkWebServiceStatus.UNAVAILABLE) {
        toast.error("Dark Web ingestion service is unavailable", {
          description: "Please ensure Docker is running and the service is properly configured",
        });
      }
    };
    
    checkStatus();
    
    // Periodically refresh logs
    const logInterval = setInterval(async () => {
      if (serviceStatus !== DarkWebServiceStatus.UNAVAILABLE) {
        const newLogs = await getDarkWebServiceLogs();
        setLogs(newLogs);
      }
    }, 10000);
    
    return () => clearInterval(logInterval);
  }, [serviceStatus]);

  // Handle URL submission
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!urls.trim()) {
      toast.error("Please enter at least one .onion URL");
      return;
    }
    
    const urlList = urls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);
    
    if (urlList.length === 0) {
      toast.error("No valid URLs found");
      return;
    }
    
    setProcessing(true);
    setServiceStatus(DarkWebServiceStatus.RUNNING);
    
    try {
      const result = await ingestOnionUrls(urlList);
      setResult(result);
      
      if (result.success) {
        toast.success(`Successfully processed ${result.urlsProcessed} URLs`);
      } else {
        toast.error("Error processing URLs", {
          description: result.errors.join(", ")
        });
      }
    } catch (error) {
      toast.error("Failed to process URLs", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setProcessing(false);
      setServiceStatus(DarkWebServiceStatus.AVAILABLE);
      // Refresh logs after processing
      const newLogs = await getDarkWebServiceLogs();
      setLogs(newLogs);
    }
  };
  
  // Handle file submission
  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      toast.error("Please select a file containing .onion URLs");
      return;
    }
    
    setProcessing(true);
    setServiceStatus(DarkWebServiceStatus.RUNNING);
    
    try {
      // In a real implementation, we would upload the file to a secure location
      // and then process it with the Docker container
      const result = await ingestOnionUrlsFromFile(file.name);
      setResult(result);
      
      if (result.success) {
        toast.success(`Successfully processed ${result.urlsProcessed} URLs from file`);
      } else {
        toast.error("Error processing file", {
          description: result.errors.join(", ")
        });
      }
    } catch (error) {
      toast.error("Failed to process file", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setProcessing(false);
      setServiceStatus(DarkWebServiceStatus.AVAILABLE);
      // Refresh logs after processing
      const newLogs = await getDarkWebServiceLogs();
      setLogs(newLogs);
    }
  };
  
  // Handle discovery submission
  const handleDiscoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQueries.trim()) {
      toast.error("Please enter at least one search query");
      return;
    }
    
    const queryList = searchQueries
      .split('\n')
      .map(query => query.trim())
      .filter(query => query.length > 0);
    
    if (queryList.length === 0) {
      toast.error("No valid search queries found");
      return;
    }
    
    setProcessing(true);
    setServiceStatus(DarkWebServiceStatus.RUNNING);
    
    try {
      const result = await discoverAndIngestOnionUrls(queryList, discoveryLimit);
      setResult(result);
      
      if (result.success) {
        toast.success(`Successfully discovered ${result.urlsDiscovered} URLs and processed ${result.urlsProcessed}`);
      } else {
        toast.error("Error during discovery and ingestion", {
          description: result.errors.join(", ")
        });
      }
    } catch (error) {
      toast.error("Failed to run discovery", {
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setProcessing(false);
      setServiceStatus(DarkWebServiceStatus.AVAILABLE);
      // Refresh logs after processing
      const newLogs = await getDarkWebServiceLogs();
      setLogs(newLogs);
    }
  };
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };
  
  // Get status indicator color based on service status
  const getStatusColor = () => {
    switch (serviceStatus) {
      case DarkWebServiceStatus.AVAILABLE:
        return "bg-green-500";
      case DarkWebServiceStatus.RUNNING:
        return "bg-amber-500";
      default:
        return "bg-red-500";
    }
  };
  
  // Get status text based on service status
  const getStatusText = () => {
    switch (serviceStatus) {
      case DarkWebServiceStatus.AVAILABLE:
        return "Available";
      case DarkWebServiceStatus.RUNNING:
        return "Processing";
      default:
        return "Unavailable";
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Dark Web Ingestion</CardTitle>
            <CardDescription>
              Securely ingest content from .onion URLs through a sandboxed container
            </CardDescription>
          </div>
          <div className="flex items-center">
            <span className="mr-2 text-sm">Status:</span>
            <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
            <span className="ml-1 text-sm">{getStatusText()}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Alert className="mb-4 bg-yellow-50 border-yellow-100">
          <AlertDescription>
            This tool uses isolated Docker containers and secure Tor routing to safely 
            ingest dark web content. All security measures are enforced.
          </AlertDescription>
        </Alert>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="urls" className="flex-1">URL List</TabsTrigger>
            <TabsTrigger value="file" className="flex-1">File Upload</TabsTrigger>
            <TabsTrigger value="discovery" className="flex-1">Deep Discovery</TabsTrigger>
            <TabsTrigger value="logs" className="flex-1">Logs</TabsTrigger>
          </TabsList>
          
          <TabsContent value="urls">
            <form onSubmit={handleUrlSubmit}>
              <Textarea
                placeholder="Enter .onion URLs (one per line)"
                className="min-h-[200px] font-mono text-sm mb-4"
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
              />
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
              >
                {processing ? (
                  <>
                    <Spinner className="mr-2" />
                    Processing URLs...
                  </>
                ) : "Process URLs"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="file">
            <form onSubmit={handleFileSubmit}>
              <div className="mb-4">
                <Input
                  type="file"
                  accept=".json,.txt"
                  onChange={handleFileChange}
                  disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Upload a JSON array of URLs or a text file with one URL per line
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={!file || processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
              >
                {processing ? (
                  <>
                    <Spinner className="mr-2" />
                    Processing File...
                  </>
                ) : "Process File"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="discovery">
            <form onSubmit={handleDiscoverySubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Queries (one per line)
                </label>
                <Textarea
                  placeholder="Enter search queries (one per line)"
                  className="min-h-[150px] font-mono text-sm mb-3"
                  value={searchQueries}
                  onChange={(e) => setSearchQueries(e.target.value)}
                  disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
                />
                <div className="flex items-center">
                  <label htmlFor="discovery-limit" className="block text-sm font-medium text-gray-700 mr-2">
                    Max URLs per query:
                  </label>
                  <Input
                    id="discovery-limit"
                    type="number"
                    min={1}
                    max={100}
                    value={discoveryLimit}
                    onChange={(e) => setDiscoveryLimit(parseInt(e.target.value) || 20)}
                    className="w-24"
                    disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Uses Deep Explorer to discover .onion URLs based on search queries
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={processing || serviceStatus === DarkWebServiceStatus.UNAVAILABLE}
              >
                {processing ? (
                  <>
                    <Spinner className="mr-2" />
                    Running Deep Discovery...
                  </>
                ) : "Run Deep Discovery"}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="logs">
            <div className="bg-black rounded-md p-4 text-green-400 font-mono text-xs h-[300px] overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">{log}</div>
                ))
              ) : (
                <div>No logs available</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        
        {result && (
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Processing Results</h3>
            {/* Display discovery-specific results if available */}
            {(result as DarkWebDiscoveryResult).urlsDiscovered !== undefined && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Queries Processed</p>
                  <p className="text-xl font-bold">
                    {(result as DarkWebDiscoveryResult).queriesProcessed} of {(result as DarkWebDiscoveryResult).queriesTotal}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">URLs Discovered</p>
                  <p className="text-xl font-bold">{(result as DarkWebDiscoveryResult).urlsDiscovered}</p>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-500">URLs Processed</p>
                <p className="text-xl font-bold">{result.urlsProcessed} of {result.urlsTotal}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Chunks Ingested</p>
                <p className="text-xl font-bold">{result.chunksIngested}</p>
              </div>
            </div>
            
            <Progress 
              value={(result.urlsProcessed / Math.max(result.urlsTotal, 1)) * 100} 
              className="mb-4"
            />
            
            {result.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-red-500 mb-1">Errors</h4>
                <ul className="text-sm list-disc pl-5">
                  {result.errors.map((error, index) => (
                    <li key={index} className="text-red-500">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between border-t pt-4">
        <p className="text-xs text-gray-500">
          All data is processed securely with multiple layers of isolation
        </p>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            setUrls('');
            setFile(null);
            setSearchQueries('');
            setResult(null);
          }}
        >
          Reset
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DarkWebIngestionPanel;
