
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
  CIRCUIT: 'circuit'
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

// Circuit management
const TOR_CIRCUITS = [
  { id: 1, port: 9050, status: 'ready', lastUsed: 0, cooldown: false },
  { id: 2, port: 9051, status: 'ready', lastUsed: 0, cooldown: false },
  { id: 3, port: 9052, status: 'ready', lastUsed: 0, cooldown: false }
];

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
}

// Initialize on module load
initRequestProcessor();

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
  
  try {
    // Add random jitter before request (0.5-2s)
    const jitter = 500 + Math.random() * 1500;
    await new Promise(resolve => setTimeout(resolve, jitter));
    
    // Build the URL with circuit port info
    const url = `${API_BASE_URL}/${request.endpoint}`;
    
    const options: RequestInit = {
      method: request.method,
      headers: {
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
async function rotateCircuit(circuitId: number) {
  try {
    const circuit = TOR_CIRCUITS.find(c => c.id === circuitId);
    if (!circuit) return;
    
    console.log(`Rotating circuit ${circuitId}`);
    
    // Skip actual API call in dev mode
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Simulated circuit rotation for circuit ${circuitId}`);
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
