
/**
 * Enhanced Tor Network Service with Advanced Infrastructure Management
 * This module handles direct Tor network interactions with resilience features:
 * - Adaptive concurrency control
 * - Local request caching with TTL
 * - Multiple Tor circuit management
 */

import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';

// API base URL configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api/dark-web' 
  : 'http://localhost:3001/api/dark-web';

// Endpoints
const ENDPOINTS = {
  STATUS: 'status',
  CONNECT: 'connect',
  QUERY: 'query',
  LOGS: 'logs',
  EXPLORE: 'explore',
  CIRCUIT: 'circuit',
  SECURITY: 'security'
};

// Queue and concurrency settings
interface QueueItem {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST';
  data?: any;
  circuitId?: number;
  priority: number;
  timestamp: number;
  retries: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

// Concurrency control
const MAX_CONCURRENT_REQUESTS = 3;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000; // Base delay in ms
let activeRequests = 0;
const requestQueue: QueueItem[] = [];

// Anti-fingerprinting settings
interface UserAgent {
  agent: string;
  weight: number;
  platform: string;
}

// Common User-Agent strings with their usage weights
const USER_AGENTS: UserAgent[] = [
  { agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/117.0", weight: 25, platform: "Windows" },
  { agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0", weight: 15, platform: "macOS" },
  { agent: "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/117.0", weight: 10, platform: "Linux" },
  { agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36", weight: 25, platform: "Windows" },
  { agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36", weight: 15, platform: "macOS" },
  { agent: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36", weight: 10, platform: "Android" }
];

// Accept-Language variants
const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
  "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
  "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7",
  "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
];

// Circuit management
const TOR_CIRCUITS = [
  { id: 1, port: 9050, status: 'ready', lastUsed: 0, cooldown: false, requestCount: 0 },
  { id: 2, port: 9051, status: 'ready', lastUsed: 0, cooldown: false, requestCount: 0 },
  { id: 3, port: 9052, status: 'ready', lastUsed: 0, cooldown: false, requestCount: 0 }
];

// Circuit rotation thresholds
const CIRCUIT_ROTATION = {
  MAX_REQUESTS: 8, // Rotate after 8 requests
  MIN_INTERVAL: 1000 * 60 * 5, // 5 minutes
  MAX_INTERVAL: 1000 * 60 * 10 // 10 minutes
};

// Cache management
interface CacheEntry {
  data: any;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes in ms

/**
 * Initialize the request processor
 */
function initRequestProcessor() {
  // Start the queue processor if not already running
  setInterval(processQueue, 100);
  console.log("Tor request processor initialized");
  
  // Setup random circuit rotation intervals
  setupRandomCircuitRotation();
}

// Initialize on module load
initRequestProcessor();

/**
 * Setup random circuit rotation intervals for enhanced security
 */
function setupRandomCircuitRotation() {
  TOR_CIRCUITS.forEach(circuit => {
    // For each circuit, set a random rotation interval
    const randomInterval = CIRCUIT_ROTATION.MIN_INTERVAL + 
      Math.random() * (CIRCUIT_ROTATION.MAX_INTERVAL - CIRCUIT_ROTATION.MIN_INTERVAL);
    
    setInterval(() => {
      if (circuit.status === 'ready' && !circuit.cooldown && circuit.requestCount > 0) {
        console.log(`Automatic circuit rotation for circuit ${circuit.id} after ${Math.round(randomInterval/1000)}s`);
        rotateCircuit(circuit.id);
      }
    }, randomInterval);
  });
}

/**
 * Process the request queue with adaptive concurrency
 */
function processQueue() {
  if (requestQueue.length === 0 || activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  // Sort by priority (higher first), then timestamp
  requestQueue.sort((a, b) => 
    b.priority !== a.priority 
      ? b.priority - a.priority 
      : a.timestamp - b.timestamp
  );

  // Pick the next request
  const request = requestQueue.shift();
  if (!request) return;
  
  // Find available circuit or use default
  const circuitId = request.circuitId || getAvailableCircuit().id;
  
  // Execute the request
  activeRequests++;
  executeRequest(request, circuitId)
    .finally(() => {
      activeRequests--;
      // Continue processing the queue
      if (requestQueue.length > 0) {
        processQueue();
      }
    });
}

/**
 * Execute a single request with the specified circuit
 */
async function executeRequest(request: QueueItem, circuitId: number): Promise<void> {
  const circuit = TOR_CIRCUITS.find(c => c.id === circuitId);
  if (!circuit || circuit.cooldown) {
    // Circuit unavailable, requeue with a different circuit
    request.circuitId = getAvailableCircuit().id;
    requestQueue.push(request);
    return;
  }

  // Update circuit status
  circuit.lastUsed = Date.now();
  circuit.status = 'busy';
  circuit.requestCount++; // Increment request count for this circuit
  
  // Check if circuit needs rotation based on request count
  const needsRotation = circuit.requestCount >= CIRCUIT_ROTATION.MAX_REQUESTS;
  
  try {
    // Add random jitter before request (0.5-2s)
    const jitter = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, jitter));
    
    // Build the URL with circuit port info
    const url = `${API_BASE_URL}/${request.endpoint}`;
    
    // Generate randomized request headers for anti-fingerprinting
    const headers = generateRandomHeaders();
    
    const options: RequestInit = {
      method: request.method,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Circuit-Id': circuitId.toString(),
        'X-Request-Id': request.id
      }
    };
    
    if (request.data && request.method === 'POST') {
      options.body = JSON.stringify(request.data);
    }
    
    // Make the actual request
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed (${response.status}): ${errorText}`);
    }
    
    // Parse response
    const contentType = response.headers.get('content-type');
    let result;
    
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const textResponse = await response.text();
      result = { content: textResponse };
    }
    
    // Success, resolve the promise
    request.resolve(result);
    
    // Rotate circuit if needed after successful request
    if (needsRotation) {
      console.log(`Circuit ${circuitId} has processed ${circuit.requestCount} requests - rotating`);
      rotateCircuit(circuitId);
    }
  } catch (error) {
    console.error(`Error in Tor request (circuit ${circuitId}):`, error);
    
    if (request.retries < MAX_RETRIES) {
      // Apply exponential backoff with jitter for retries
      const delay = RETRY_DELAY_BASE * Math.pow(2, request.retries) * (0.75 + Math.random() * 0.5);
      console.log(`Retrying request after ${Math.round(delay)}ms (attempt ${request.retries + 1}/${MAX_RETRIES})`);
      
      // Increase retry count and requeue with a different circuit
      request.retries++;
      request.circuitId = getAvailableCircuit(circuitId).id; // Avoid same circuit
      
      setTimeout(() => {
        requestQueue.push(request);
      }, delay);
    } else {
      // Max retries reached, reject the promise
      request.reject(new Error(`Request failed after ${MAX_RETRIES} attempts: ${error.message}`));
      
      // Put circuit in cooldown if we've had repeated failures
      circuit.cooldown = true;
      setTimeout(() => {
        circuit.cooldown = false;
        circuit.status = 'ready';
        console.log(`Circuit ${circuitId} cooldown ended`);
      }, 30000); // 30 second cooldown
      
      // Rotate circuit after failures
      rotateCircuit(circuitId);
    }
  } finally {
    // Reset circuit to ready state
    circuit.status = 'ready';
  }
}

/**
 * Get an available Tor circuit, avoiding the specified one
 */
function getAvailableCircuit(avoidCircuitId?: number) {
  // Filter out the circuit to avoid and any in cooldown
  const availableCircuits = TOR_CIRCUITS.filter(c => 
    c.id !== avoidCircuitId && 
    !c.cooldown && 
    c.status === 'ready'
  );
  
  if (availableCircuits.length === 0) {
    // If no available circuits, just use any non-cooling circuit
    const anyCircuit = TOR_CIRCUITS.find(c => !c.cooldown) || TOR_CIRCUITS[0];
    return anyCircuit;
  }
  
  // Sort by least recently used
  availableCircuits.sort((a, b) => a.lastUsed - b.lastUsed);
  return availableCircuits[0];
}

/**
 * Request a circuit rotation for the specified circuit ID
 */
export async function rotateCircuit(circuitId: number) {
  try {
    const circuit = TOR_CIRCUITS.find(c => c.id === circuitId);
    if (!circuit) return;
    
    console.log(`Rotating circuit ${circuitId}`);
    
    // Skip actual API call in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Simulated circuit rotation for circuit ${circuitId}`);
      
      // Reset request counter even in dev mode
      if (circuit) {
        circuit.requestCount = 0;
      }
      return;
    }
    
    // Request circuit rotation from API
    await fetch(`${API_BASE_URL}/${ENDPOINTS.CIRCUIT}/rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ circuitId })
    });
    
    // Reset request counter for this circuit
    if (circuit) {
      circuit.requestCount = 0;
    }
    
    console.log(`Circuit ${circuitId} rotated successfully`);
  } catch (error) {
    console.error(`Failed to rotate circuit ${circuitId}:`, error);
  }
}

/**
 * Generate a cache key for a request
 */
function generateCacheKey(endpoint: string, method: string, data?: any): string {
  return `${endpoint}:${method}:${data ? JSON.stringify(data) : ''}`;
}

/**
 * Check if a value exists in the cache
 */
function getCachedResponse(cacheKey: string): any | null {
  if (!cache.has(cacheKey)) {
    return null;
  }
  
  const entry = cache.get(cacheKey)!;
  
  // Check if expired
  if (entry.expiry < Date.now()) {
    cache.delete(cacheKey);
    return null;
  }
  
  return entry.data;
}

/**
 * Store a value in the cache
 */
function cacheResponse(cacheKey: string, data: any, ttl: number = DEFAULT_TTL): void {
  cache.set(cacheKey, {
    data,
    expiry: Date.now() + ttl
  });
}

/**
 * Clean expired items from cache (run periodically)
 */
function cleanCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiry < now) {
      cache.delete(key);
    }
  }
}

// Set up periodic cache cleaning
setInterval(cleanCache, 60000); // Clean every minute

/**
 * Generate randomized request headers for anti-fingerprinting
 */
function generateRandomHeaders(): Record<string, string> {
  // Select a random user agent based on weights
  let totalWeight = USER_AGENTS.reduce((sum, agent) => sum + agent.weight, 0);
  let randomWeight = Math.random() * totalWeight;
  let selectedAgent = USER_AGENTS[0];
  
  for (const agent of USER_AGENTS) {
    if (randomWeight < agent.weight) {
      selectedAgent = agent;
      break;
    }
    randomWeight -= agent.weight;
  }
  
  // Generate randomized headers
  return {
    'User-Agent': selectedAgent.agent,
    'Accept-Language': ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'DNT': Math.random() > 0.5 ? '1' : undefined,
    'Sec-Fetch-Dest': Math.random() > 0.5 ? 'document' : undefined,
    'Sec-Fetch-Mode': Math.random() > 0.5 ? 'navigate' : undefined,
    'Sec-Fetch-Site': Math.random() > 0.5 ? 'none' : undefined,
    'Sec-Fetch-User': Math.random() > 0.7 ? '?1' : undefined,
    'Upgrade-Insecure-Requests': '1',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'Accept-Encoding': 'gzip, deflate, br',
  };
}

/**
 * Queue a request to the Tor network
 */
export async function queueTorRequest(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET',
  data?: any,
  options: {
    priority?: number,
    circuitId?: number,
    cacheTTL?: number | null // null means no caching
  } = {}
): Promise<any> {
  // Check cache first if caching is enabled
  if (options.cacheTTL !== null) {
    const cacheKey = generateCacheKey(endpoint, method, data);
    const cachedResponse = getCachedResponse(cacheKey);
    
    if (cachedResponse) {
      console.log(`Cache hit for ${endpoint}`);
      return cachedResponse;
    }
  }
  
  // Create request object
  const requestId = uuidv4();
  const priority = options.priority || 1; // Default priority
  
  return new Promise((resolve, reject) => {
    // Add request to queue
    requestQueue.push({
      id: requestId,
      endpoint,
      method,
      data,
      circuitId: options.circuitId,
      priority,
      timestamp: Date.now(),
      retries: 0,
      resolve: (result) => {
        // If caching is enabled, store in cache
        if (options.cacheTTL !== null) {
          const cacheKey = generateCacheKey(endpoint, method, data);
          cacheResponse(cacheKey, result, options.cacheTTL);
        }
        resolve(result);
      },
      reject
    });
    
    // Process queue immediately if we're below concurrency limit
    if (activeRequests < MAX_CONCURRENT_REQUESTS) {
      processQueue();
    }
  });
}

/**
 * Sends a query through the Tor network with caching and queueing
 * @param query The query to send through Tor
 */
export async function queryTorNetwork(query: string): Promise<string> {
  try {
    // Use short cache TTL for queries (2 minutes)
    const response = await queueTorRequest(
      ENDPOINTS.QUERY, 
      'POST', 
      { query },
      { cacheTTL: 2 * 60 * 1000, priority: 2 }
    );
    
    if (!response || !response.content) {
      throw new Error("Invalid response from Tor network");
    }
    
    return response.content;
  } catch (error) {
    console.error('Error querying Tor network:', error);
    throw error;
  }
}

/**
 * Explore the Tor network for resources with caching and retries
 * @param topic The topic to explore
 * @param depth Search depth (1-3)
 */
export async function exploreTorNetwork(topic: string, depth: number = 1): Promise<any> {
  try {
    // Longer cache (1 hour) for exploratory searches
    return await queueTorRequest(
      ENDPOINTS.EXPLORE, 
      'POST', 
      { 
        topic,
        depth: Math.min(Math.max(depth, 1), 3) // Limit depth between 1-3
      },
      { cacheTTL: 60 * 60 * 1000 }
    );
  } catch (error) {
    console.error('Error exploring Tor network:', error);
    throw error;
  }
}

/**
 * Get Tor network logs with priority queueing
 */
export async function getTorLogs(): Promise<string[]> {
  try {
    // Short cache for logs (30 seconds)
    const response = await queueTorRequest(
      ENDPOINTS.LOGS,
      'GET',
      undefined,
      { cacheTTL: 30 * 1000, priority: 1 }
    );
    return response.logs || [];
  } catch (error) {
    console.error('Error getting Tor logs:', error);
    return ['Error retrieving logs'];
  }
}

/**
 * Check if the Tor service is available
 */
export async function checkTorServiceAvailability(): Promise<boolean> {
  try {
    // Very short cache for status (10 seconds)
    const status = await queueTorRequest(
      ENDPOINTS.STATUS,
      'GET',
      undefined,
      { cacheTTL: 10 * 1000, priority: 3 } // High priority
    );
    return status && (status.status === 'available' || status.status === 'running');
  } catch (error) {
    console.error('Error checking Tor service availability:', error);
    return false;
  }
}

/**
 * Establish a connection to the Tor network
 */
export async function establishTorConnection(): Promise<boolean> {
  try {
    // No caching for connection requests
    const result = await queueTorRequest(
      ENDPOINTS.CONNECT, 
      'POST',
      undefined,
      { cacheTTL: null, priority: 3 } // High priority
    );
    return result && (result.success || result.status === 'connected');
  } catch (error) {
    console.error('Error establishing Tor connection:', error);
    return false;
  }
}

/**
 * Get information about Tor circuits
 */
export async function getTorCircuitInfo(): Promise<any> {
  try {
    // Get circuit info (e.g. for debugging)
    return await queueTorRequest(
      ENDPOINTS.CIRCUIT,
      'GET',
      undefined,
      { cacheTTL: 15 * 1000 }
    );
  } catch (error) {
    console.error('Error getting circuit info:', error);
    return { circuits: [] };
  }
}

/**
 * Clear cached data for a specific endpoint or all endpoints
 */
export function clearTorCache(endpoint?: string): void {
  if (!endpoint) {
    // Clear entire cache
    cache.clear();
    console.log('Cleared all cached Tor requests');
    return;
  }
  
  // Clear specific endpoint
  const prefix = `${endpoint}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
  console.log(`Cleared cached Tor requests for endpoint: ${endpoint}`);
}

/**
 * Update TorNetworkStatus component to display the new connection status with circuit info
 */
export function updateTorNetworkStatus(): { isActive: boolean, circuitsAvailable: number } {
  const activeCircuits = TOR_CIRCUITS.filter(c => !c.cooldown && c.status === 'ready').length;
  return {
    isActive: activeCircuits > 0,
    circuitsAvailable: activeCircuits
  };
}

/**
 * Get Tor network stats - performance and reliability metrics
 */
export async function getTorNetworkStats(): Promise<any> {
  try {
    // Cache stats for 1 minute
    return await queueTorRequest(
      'stats',
      'GET',
      undefined,
      { cacheTTL: 60 * 1000 }
    );
  } catch (error) {
    console.error('Error fetching Tor network stats:', error);
    return {
      uptime: 0,
      requestsProcessed: 0,
      averageLatency: 0,
      circuits: []
    };
  }
}

/**
 * Request the execution of an isolated container job through the backend
 * @param jobType The type of isolated job to run
 * @param jobData Data needed for the job
 */
export async function runIsolatedJob(jobType: string, jobData: any): Promise<any> {
  try {
    // Jobs should never be cached
    return await queueTorRequest(
      `jobs/${jobType}`,
      'POST',
      jobData,
      { cacheTTL: null, priority: 2 }
    );
  } catch (error) {
    console.error(`Error running isolated job (${jobType}):`, error);
    throw new Error(`Failed to run isolated job: ${error.message}`);
  }
}

/**
 * Verify the security configuration of the Tor setup
 */
export async function verifySecurityConfiguration(): Promise<{
  leakProtection: boolean,
  fingerprinting: boolean,
  dnsProtection: boolean,
  ipProtection: boolean,
  containerIsolation: boolean,
}> {
  try {
    const result = await queueTorRequest(
      ENDPOINTS.SECURITY + '/verify',
      'GET',
      undefined,
      { cacheTTL: 60 * 1000, priority: 3 }
    );
    
    return result;
  } catch (error) {
    console.error('Error verifying security configuration:', error);
    // Return pessimistic defaults
    return {
      leakProtection: false,
      fingerprinting: false,
      dnsProtection: false,
      ipProtection: false,
      containerIsolation: false
    };
  }
}

/**
 * Initialize an ephemeral job container for isolated tasks
 * @param jobConfig Configuration for the ephemeral job
 */
export async function createEphemeralJob(jobConfig: {
  urls: string[],
  depth: number,
  timeout: number,
  userAgent?: string,
  acceptLanguage?: string,
  useTls?: boolean
}): Promise<{jobId: string}> {
  try {
    // Submit ephemeral job request
    const response = await queueTorRequest(
      'jobs/ephemeral',
      'POST',
      {
        ...jobConfig,
        // If user didn't specify custom fingerprinting, use random ones
        userAgent: jobConfig.userAgent || generateRandomHeaders()['User-Agent'],
        acceptLanguage: jobConfig.acceptLanguage || ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
      },
      { cacheTTL: null, priority: 3 }
    );
    
    if (!response || !response.jobId) {
      throw new Error("Failed to create ephemeral job");
    }
    
    toast(`Ephemeral job created with ID: ${response.jobId}`);
    return response;
  } catch (error) {
    console.error('Error creating ephemeral job:', error);
    toast.error(`Failed to create ephemeral job: ${error.message}`);
    throw error;
  }
}

/**
 * Get status of an ephemeral job
 * @param jobId The ID of the ephemeral job
 */
export async function getEphemeralJobStatus(jobId: string): Promise<any> {
  try {
    // Very brief cache for job status (5 seconds)
    return await queueTorRequest(
      `jobs/ephemeral/${jobId}`,
      'GET',
      undefined,
      { cacheTTL: 5 * 1000 }
    );
  } catch (error) {
    console.error(`Error getting status for ephemeral job ${jobId}:`, error);
    throw error;
  }
}
