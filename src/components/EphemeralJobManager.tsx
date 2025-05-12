
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Folder, Shield, TerminalSquare, AlertTriangle } from 'lucide-react';
import { createEphemeralJob, getEphemeralJobStatus } from '@/utils/torNetworkService';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';

const jobFormSchema = z.object({
  urls: z.string()
    .min(1, 'At least one URL is required')
    .refine(urls => {
      const urlList = urls.split('\n').map(url => url.trim()).filter(Boolean);
      return urlList.length > 0 && urlList.length <= 10;
    }, 'Between 1 and 10 URLs are required'),
  depth: z.number().min(1).max(3),
  timeout: z.number().min(30).max(300),
  useTls: z.boolean().default(true),
  customUserAgent: z.boolean().default(false),
  userAgent: z.string().optional(),
  customAcceptLanguage: z.boolean().default(false),
  acceptLanguage: z.string().optional()
});

type JobFormValues = z.infer<typeof jobFormSchema>;

interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  results?: string[];
  error?: string;
  startTime: Date;
  endTime?: Date;
}

const EphemeralJobManager = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [jobs, setJobs] = useState<JobStatus[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobStatus | null>(null);
  const [isViewingResults, setIsViewingResults] = useState(false);
  
  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      urls: '',
      depth: 1,
      timeout: 120,
      useTls: true,
      customUserAgent: false,
      customAcceptLanguage: false,
    }
  });
  
  const watchCustomUserAgent = form.watch('customUserAgent');
  const watchCustomAcceptLanguage = form.watch('customAcceptLanguage');
  
  // Submit handler for the form
  const onSubmit = async (data: JobFormValues) => {
    try {
      const urls = data.urls
        .split('\n')
        .map(url => url.trim())
        .filter(Boolean);
      
      const jobConfig = {
        urls,
        depth: data.depth,
        timeout: data.timeout,
        useTls: data.useTls,
        ...(data.customUserAgent && data.userAgent ? { userAgent: data.userAgent } : {}),
        ...(data.customAcceptLanguage && data.acceptLanguage ? { acceptLanguage: data.acceptLanguage } : {})
      };
      
      // Create the job
      const response = await createEphemeralJob(jobConfig);
      
      // Add job to the list
      const newJob: JobStatus = {
        id: response.jobId,
        status: 'pending',
        progress: 0,
        startTime: new Date(),
      };
      
      setJobs(prev => [newJob, ...prev]);
      setIsDialogOpen(false);
      form.reset();
      
      // Setup polling for job status
      pollJobStatus(response.jobId);
      
    } catch (error) {
      console.error("Failed to create job:", error);
      toast.error(`Failed to create job: ${error.message}`);
    }
  };
  
  // Poll for job status updates
  const pollJobStatus = (jobId: string) => {
    const intervalId = setInterval(async () => {
      try {
        const status = await getEphemeralJobStatus(jobId);
        
        setJobs(prev => prev.map(job => 
          job.id === jobId ? {
            ...job,
            status: status.status,
            progress: status.progress,
            results: status.results,
            error: status.error,
            endTime: status.status === 'completed' || status.status === 'failed' ? new Date() : job.endTime
          } : job
        ));
        
        // Stop polling if the job is completed or failed
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(intervalId);
          
          if (status.status === 'completed') {
            toast.success(`Job ${jobId} completed successfully`);
          } else {
            toast.error(`Job ${jobId} failed: ${status.error || 'Unknown error'}`);
          }
        }
      } catch (error) {
        console.error(`Error polling job status for ${jobId}:`, error);
        
        // If we can't get the status, mark as failed after a few retries
        setJobs(prev => {
          const job = prev.find(j => j.id === jobId);
          if (job && job.status === 'pending' && Date.now() - job.startTime.getTime() > 30000) {
            clearInterval(intervalId);
            return prev.map(j => j.id === jobId ? {
              ...j,
              status: 'failed',
              error: 'Failed to get job status',
              endTime: new Date()
            } : j);
          }
          return prev;
        });
      }
    }, 3000); // Poll every 3 seconds
    
    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  };
  
  const viewJobResults = (job: JobStatus) => {
    setSelectedJob(job);
    setIsViewingResults(true);
  };
  
  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Ephemeral Jobs</h2>
        <p className="text-gray-600 mb-4">
          Create isolated, ephemeral containers to run dark web jobs with maximum security.
          Each job runs in a dedicated container that is destroyed after completion.
        </p>
        
        <div className="flex gap-4 mb-6">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <TerminalSquare className="h-4 w-4" />
                Create Ephemeral Job
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-700" />
                  Create Ephemeral Job
                </DialogTitle>
                <DialogDescription>
                  This will create an isolated container that will be destroyed after the job completes.
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="urls"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URLs to Process</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter URLs (one per line, max 10)"
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Enter .onion URLs, one per line (maximum 10)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="depth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Search Depth (1-3)</FormLabel>
                          <FormControl>
                            <Slider
                              min={1}
                              max={3}
                              step={1}
                              defaultValue={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                            />
                          </FormControl>
                          <FormDescription className="text-center">
                            Current: {field.value}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="timeout"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Timeout (seconds)</FormLabel>
                          <FormControl>
                            <Slider
                              min={30}
                              max={300}
                              step={30}
                              defaultValue={[field.value]}
                              onValueChange={(value) => field.onChange(value[0])}
                            />
                          </FormControl>
                          <FormDescription className="text-center">
                            Current: {field.value} seconds
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="useTls"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use TLS Fingerprint Randomization
                          </FormLabel>
                          <FormDescription>
                            Enhance anonymity by randomizing TLS parameters
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="customUserAgent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Custom User-Agent
                          </FormLabel>
                          <FormDescription>
                            Override the randomized User-Agent
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {watchCustomUserAgent && (
                    <FormField
                      control={form.control}
                      name="userAgent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User-Agent</FormLabel>
                          <FormControl>
                            <Input placeholder="Custom User-Agent string" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <FormField
                    control={form.control}
                    name="customAcceptLanguage"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Use Custom Accept-Language
                          </FormLabel>
                          <FormDescription>
                            Override the randomized Accept-Language
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {watchCustomAcceptLanguage && (
                    <FormField
                      control={form.control}
                      name="acceptLanguage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Accept-Language</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. en-US,en;q=0.9" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  
                  <DialogFooter>
                    <Button type="submit" className="gap-2">
                      <TerminalSquare className="h-4 w-4" />
                      Create Ephemeral Job
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        
        <h3 className="font-medium text-lg mb-3">Recent Jobs</h3>
        {jobs.length === 0 ? (
          <div className="text-center p-8 border rounded-md bg-gray-50">
            <Folder className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-600">No jobs have been created yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {jobs.map((job) => (
              <Card key={job.id} className="overflow-hidden">
                <CardHeader className="bg-slate-50 pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TerminalSquare className="h-4 w-4" /> 
                        Job {job.id.substring(0, 8)}...
                      </CardTitle>
                      <CardDescription>
                        {new Date(job.startTime).toLocaleString()}
                      </CardDescription>
                    </div>
                    {job.status === 'running' && (
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full animate-pulse">
                        Running
                      </span>
                    )}
                    {job.status === 'pending' && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                        Pending
                      </span>
                    )}
                    {job.status === 'completed' && (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                        Completed
                      </span>
                    )}
                    {job.status === 'failed' && (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                        Failed
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {job.status === 'running' && (
                    <div className="mb-4">
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all duration-500 ease-in-out"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-center text-slate-500">
                        {job.progress}% complete
                      </p>
                    </div>
                  )}
                  
                  {job.status === 'failed' && job.error && (
                    <div className="p-3 mb-4 bg-red-50 text-red-700 rounded border border-red-200 flex gap-2">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500" />
                      <p className="text-sm">{job.error}</p>
                    </div>
                  )}
                  
                  {job.results && job.results.length > 0 && (
                    <p className="text-sm mb-2">
                      {job.results.length} result{job.results.length !== 1 ? 's' : ''} found
                    </p>
                  )}
                </CardContent>
                <CardFooter className="bg-slate-50 pt-3 flex justify-between">
                  {job.status === 'completed' && job.results && job.results.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs"
                      onClick={() => viewJobResults(job)}
                    >
                      View Results
                    </Button>
                  )}
                  {job.status !== 'completed' && job.status !== 'failed' && (
                    <div className="text-xs text-slate-500">
                      Running for {Math.floor((Date.now() - job.startTime.getTime()) / 1000)}s
                    </div>
                  )}
                  {(job.status === 'completed' || job.status === 'failed') && job.endTime && (
                    <div className="text-xs text-slate-500">
                      Duration: {Math.floor((job.endTime.getTime() - job.startTime.getTime()) / 1000)}s
                    </div>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Results Viewer Dialog */}
      <Dialog open={isViewingResults} onOpenChange={setIsViewingResults}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>
              Job Results: {selectedJob?.id.substring(0, 8)}...
            </DialogTitle>
            <DialogDescription>
              Data retrieved from isolated job execution
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] border rounded p-4">
            {selectedJob?.results?.map((result, index) => (
              <div key={index} className="mb-4 p-3 border rounded bg-slate-50">
                <p className="whitespace-pre-wrap font-mono text-xs">{result}</p>
              </div>
            ))}
          </ScrollArea>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsViewingResults(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EphemeralJobManager;
