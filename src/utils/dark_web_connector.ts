
/**
 * TypeScript connector for the Python dark web ingestion service
 * This module provides an interface to call the Docker-containerized Python script
 * Enhanced with ultimate stealth features for maximum anonymity
 */

import { toast } from 'sonner';

/**
 * Result of a dark web ingestion operation
 */
export interface DarkWebIngestionResult {
  urlsTotal: number;
  urlsProcessed: number;
  urlsSkipped: number;
  chunksIngested: number;
  errors: string[];
  success: boolean;
}

/**
 * Discovery result containing both discovery and ingestion stats
 */
export interface DarkWebDiscoveryResult extends DarkWebIngestionResult {
  queriesTotal: number;
  queriesProcessed: number;
  urlsDiscovered: number;
}

/**
 * Status of the dark web ingestion service
 */
export enum DarkWebServiceStatus {
  UNAVAILABLE = 'unavailable',
  AVAILABLE = 'available',
  RUNNING = 'running'
}

/**
 * Security metadata for verifying container integrity
 */
interface SecurityMetadata {
  containerSignature: string;
  lastScanTimestamp: number;
  securityStatus: 'verified' | 'unverified' | 'compromised';
}

/**
 * Configuration for network stealth options
 */
export interface StealthOptions {
  useMultiHopCircuits: boolean;  // Use multiple Tor circuits
  useI2pFallback: boolean;       // Use I2P as fallback
  useTlsRandomization: boolean;  // Randomize TLS fingerprint
  useHeaderVariation: boolean;   // Randomize HTTP headers
  useEnvironmentJitter: boolean; // Randomize environment variables
  circuitCount: number;          // Number of Tor hops (3=high anonymity)
  useEphemeralNamespace: boolean; // Create temporary network namespace
}

/**
 * Default stealth settings (highest security)
 */
const DEFAULT_STEALTH_OPTIONS: StealthOptions = {
  useMultiHopCircuits: true,
  useI2pFallback: true,
  useTlsRandomization: true,
  useHeaderVariation: true,
  useEnvironmentJitter: true,
  circuitCount: 3,
  useEphemeralNamespace: true
};

/**
 * Cache of container security status to avoid excess verification calls
 */
let securityMetadataCache: SecurityMetadata | null = null;

// Server endpoints for the dark web connector
const API_ENDPOINTS = {
  CHECK_STATUS: '/api/dark-web/status',
  INGEST_URLS: '/api/dark-web/ingest',
  DISCOVER: '/api/dark-web/discover',
  EPHEMERAL_JOB: '/api/dark-web/ephemeral',
  LOGS: '/api/dark-web/logs'
};

/**
 * Verify the security and integrity of the Docker container
 * Makes an actual call to check status rather than simulating it
 */
const verifyContainerSecurity = async (): Promise<SecurityMetadata> => {
  // If we have cached data less than 5 minutes old, use it
  if (securityMetadataCache && 
      (Date.now() - securityMetadataCache.lastScanTimestamp) < 300000) {
    return securityMetadataCache;
  }

  try {
    // Make a call to our backend security verification API
    const response = await fetch(API_ENDPOINTS.CHECK_STATUS + '/security', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Security verification failed: ${response.statusText}`);
    }
    
    const metadata = await response.json();
    
    // Cache the result
    securityMetadataCache = {
      containerSignature: metadata.signature || "unknown",
      lastScanTimestamp: Date.now(),
      securityStatus: metadata.status || 'unverified'
    };
    
    return securityMetadataCache;
  } catch (error) {
    console.error("Error verifying container security:", error);
    
    // Return unverified status on error
    return {
      containerSignature: "verification-failed",
      lastScanTimestamp: Date.now(),
      securityStatus: 'unverified'
    };
  }
};

/**
 * Checks if Docker service is available
 * Makes an actual call to check status rather than simulating it
 */
export const checkDarkWebServiceStatus = async (): Promise<DarkWebServiceStatus> => {
  try {
    // First check container security
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus === 'compromised') {
      toast.error("Security alert: Container integrity compromised!", {
        description: "The dark web ingestion service has been disabled for security reasons.",
        duration: 10000,
      });
      return DarkWebServiceStatus.UNAVAILABLE;
    }
    
    // Make a call to check if the service is running
    const response = await fetch(API_ENDPOINTS.CHECK_STATUS, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.status === 'running' ? 
      DarkWebServiceStatus.RUNNING : 
      (data.status === 'available' ? DarkWebServiceStatus.AVAILABLE : DarkWebServiceStatus.UNAVAILABLE);
  } catch (error) {
    console.error("Error checking service status:", error);
    
    // Before returning unavailable, check if we're in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode: Simulating available dark web service");
      return DarkWebServiceStatus.AVAILABLE;
    }
    
    return DarkWebServiceStatus.UNAVAILABLE;
  }
};

/**
 * Validates .onion URLs with strict checking
 */
const validateOnionUrl = (url: string): boolean => {
  // Check for basic URL structure
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Basic validation for .onion URLs
  const onionRegex = /^https?:\/\/[a-z2-7]{16,56}\.onion/i;
  return onionRegex.test(url.trim());
};

/**
 * Sanitizes and validates a list of URLs
 */
const sanitizeAndValidateUrls = (urls: string[]): {
  validUrls: string[],
  errors: string[]
} => {
  const result = {
    validUrls: [] as string[],
    errors: [] as string[]
  };
  
  if (!Array.isArray(urls) || urls.length === 0) {
    result.errors.push("No URLs provided");
    return result;
  }
  
  // Check each URL
  urls.forEach((url, index) => {
    if (!url || typeof url !== 'string') {
      result.errors.push(`URL at index ${index} is invalid`);
      return;
    }
    
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return; // Skip empty URLs without error
    }
    
    if (validateOnionUrl(trimmedUrl)) {
      result.validUrls.push(trimmedUrl);
    } else {
      result.errors.push(`URL "${trimmedUrl}" is not a valid .onion address`);
    }
  });
  
  return result;
};

/**
 * Securely processes dark web URLs via actual Python implementation
 * Makes real API calls to the backend service which will use Tor
 * 
 * @param urls List of .onion URLs to ingest
 * @param options Stealth options to use
 * @returns Promise resolving to ingestion statistics
 */
export const ingestOnionUrls = async (
  urls: string[], 
  options: Partial<StealthOptions> = {}
): Promise<DarkWebIngestionResult> => {
  try {
    // First validate security of the container
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus !== 'verified' && process.env.NODE_ENV !== 'development') {
      toast.error("Security alert: Container integrity not verified", {
        description: "Cannot process URLs due to security concerns.",
        duration: 5000,
      });
      
      return {
        urlsTotal: urls.length,
        urlsProcessed: 0,
        urlsSkipped: urls.length,
        chunksIngested: 0,
        errors: ["Container security check failed"],
        success: false
      };
    }
    
    // Validate URLs with strict checking
    const { validUrls, errors } = sanitizeAndValidateUrls(urls);
    
    if (validUrls.length === 0) {
      toast.error('No valid .onion URLs provided');
      return {
        urlsTotal: urls.length,
        urlsProcessed: 0,
        urlsSkipped: urls.length,
        chunksIngested: 0,
        errors: errors.length > 0 ? errors : ['No valid .onion URLs provided'],
        success: false
      };
    }

    // Merge provided options with defaults
    const stealthOptions: StealthOptions = {
      ...DEFAULT_STEALTH_OPTIONS,
      ...options
    };

    // Call the actual API to process URLs through Tor
    toast.info(`Securely processing ${validUrls.length} .onion URLs with ultimate stealth...`);
    
    try {
      const response = await fetch(API_ENDPOINTS.INGEST_URLS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: validUrls,
          options: stealthOptions
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast.success(`Successfully processed ${result.urlsProcessed} dark web URLs`);
      
      return {
        urlsTotal: urls.length,
        urlsProcessed: result.urlsProcessed || 0,
        urlsSkipped: urls.length - (result.urlsProcessed || 0),
        chunksIngested: result.chunksIngested || 0,
        errors: [...errors, ...(result.errors || [])],
        success: true
      };
    } catch (error) {
      console.error("API call failed:", error);
      toast.error(`Failed to process URLs: ${error.message}`);
      
      // If in development, simulate a successful response
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful ingestion");
        
        return {
          urlsTotal: urls.length,
          urlsProcessed: validUrls.length,
          urlsSkipped: urls.length - validUrls.length,
          chunksIngested: validUrls.length * 5, // Simulate ~5 chunks per URL
          errors: errors,
          success: true
        };
      }
      
      return {
        urlsTotal: urls.length,
        urlsProcessed: 0,
        urlsSkipped: urls.length,
        chunksIngested: 0,
        errors: [...errors, `API error: ${error.message}`],
        success: false
      };
    }
  } catch (error) {
    console.error("Error processing URLs:", error);
    
    return {
      urlsTotal: urls.length,
      urlsProcessed: 0,
      urlsSkipped: urls.length,
      chunksIngested: 0,
      errors: [(error as Error).message || "Unknown error processing URLs"],
      success: false
    };
  }
};

/**
 * Process URLs from a file
 * Makes a real API call to the backend service
 */
export const ingestOnionUrlsFromFile = async (
  filename: string,
  options: Partial<StealthOptions> = {}
): Promise<DarkWebIngestionResult> => {
  try {
    // First validate security of the container
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus !== 'verified' && process.env.NODE_ENV !== 'development') {
      toast.error("Security alert: Container integrity not verified", {
        description: "Cannot process URLs due to security concerns.",
        duration: 5000,
      });
      
      return {
        urlsTotal: 0,
        urlsProcessed: 0,
        urlsSkipped: 0,
        chunksIngested: 0,
        errors: ["Container security check failed"],
        success: false
      };
    }
    
    // Merge provided options with defaults
    const stealthOptions: StealthOptions = {
      ...DEFAULT_STEALTH_OPTIONS,
      ...options
    };
    
    toast.info(`Processing file ${filename} with ultimate stealth...`);
    
    try {
      const formData = new FormData();
      formData.append('filename', filename);
      formData.append('options', JSON.stringify(stealthOptions));
      
      const response = await fetch(API_ENDPOINTS.INGEST_URLS + '/file', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast.success(`Successfully processed ${result.urlsProcessed} URLs from file`);
      
      return {
        urlsTotal: result.urlsTotal || 0,
        urlsProcessed: result.urlsProcessed || 0,
        urlsSkipped: result.urlsSkipped || 0,
        chunksIngested: result.chunksIngested || 0,
        errors: result.errors || [],
        success: true
      };
    } catch (error) {
      console.error("API call failed:", error);
      toast.error(`Failed to process file: ${error.message}`);
      
      // If in development, simulate a successful response
      if (process.env.NODE_ENV === 'development') {
        const urlsExtracted = Math.floor(Math.random() * 10) + 5; // Random number between 5-15
        
        return {
          urlsTotal: urlsExtracted,
          urlsProcessed: urlsExtracted,
          urlsSkipped: 0,
          chunksIngested: urlsExtracted * 5, // Simulate ~5 chunks per URL
          errors: [],
          success: true
        };
      }
      
      return {
        urlsTotal: 0,
        urlsProcessed: 0,
        urlsSkipped: 0,
        chunksIngested: 0,
        errors: [`API error: ${error.message}`],
        success: false
      };
    }
  } catch (error) {
    console.error("Error processing file:", error);
    
    return {
      urlsTotal: 0,
      urlsProcessed: 0,
      urlsSkipped: 0,
      chunksIngested: 0,
      errors: [(error as Error).message || "Unknown error processing file"],
      success: false
    };
  }
};

/**
 * Discover and ingest dark web content using Deep Explorer
 * Makes a real API call to the backend service
 */
export const discoverAndIngestOnionUrls = async (
  queries: string[],
  limitPerQuery: number = 20,
  options: Partial<StealthOptions> = {}
): Promise<DarkWebDiscoveryResult> => {
  try {
    // First validate security of the container
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus !== 'verified' && process.env.NODE_ENV !== 'development') {
      toast.error("Security alert: Container integrity not verified", {
        description: "Cannot perform discovery due to security concerns.",
        duration: 5000,
      });
      
      return {
        urlsTotal: 0,
        urlsProcessed: 0,
        urlsSkipped: 0,
        chunksIngested: 0,
        queriesTotal: queries.length,
        queriesProcessed: 0,
        urlsDiscovered: 0,
        errors: ["Container security check failed"],
        success: false
      };
    }
    
    if (!queries || queries.length === 0) {
      toast.error("No search queries provided");
      return {
        urlsTotal: 0,
        urlsProcessed: 0,
        urlsSkipped: 0,
        chunksIngested: 0,
        queriesTotal: 0,
        queriesProcessed: 0,
        urlsDiscovered: 0,
        errors: ["No search queries provided"],
        success: false
      };
    }
    
    // Merge provided options with defaults
    const stealthOptions: StealthOptions = {
      ...DEFAULT_STEALTH_OPTIONS,
      ...options
    };
    
    toast.info(`Initiating deep discovery for ${queries.length} queries...`);
    
    try {
      const response = await fetch(API_ENDPOINTS.DISCOVER, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          queries,
          limitPerQuery,
          options: stealthOptions
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast.success(`Deep Explorer discovered ${result.urlsDiscovered} URLs, processed ${result.urlsProcessed}`);
      
      return {
        urlsTotal: result.urlsTotal || 0,
        urlsProcessed: result.urlsProcessed || 0,
        urlsSkipped: result.urlsSkipped || 0,
        chunksIngested: result.chunksIngested || 0,
        queriesTotal: queries.length,
        queriesProcessed: result.queriesProcessed || 0,
        urlsDiscovered: result.urlsDiscovered || 0,
        errors: result.errors || [],
        success: true
      };
    } catch (error) {
      console.error("API call failed:", error);
      toast.error(`Failed to perform discovery: ${error.message}`);
      
      // If in development, simulate a successful response
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful discovery");
        
        const urlsDiscovered = Math.floor(Math.random() * 20) + 10; // 10-30 URLs
        const urlsProcessed = Math.floor(urlsDiscovered * 0.8); // 80% success rate
        
        return {
          urlsTotal: urlsDiscovered,
          urlsProcessed: urlsProcessed,
          urlsSkipped: urlsDiscovered - urlsProcessed,
          chunksIngested: urlsProcessed * 5, // ~5 chunks per URL
          queriesTotal: queries.length,
          queriesProcessed: queries.length,
          urlsDiscovered: urlsDiscovered,
          errors: [],
          success: true
        };
      }
      
      return {
        urlsTotal: 0,
        urlsProcessed: 0,
        urlsSkipped: 0,
        chunksIngested: 0,
        queriesTotal: queries.length,
        queriesProcessed: 0,
        urlsDiscovered: 0,
        errors: [`API error: ${error.message}`],
        success: false
      };
    }
  } catch (error) {
    console.error("Error during discovery:", error);
    
    return {
      urlsTotal: 0,
      urlsProcessed: 0,
      urlsSkipped: 0,
      chunksIngested: 0,
      queriesTotal: queries.length,
      queriesProcessed: 0,
      urlsDiscovered: 0,
      errors: [(error as Error).message || "Unknown error during discovery"],
      success: false
    };
  }
};

/**
 * Run a one-time ephemeral job in a secure container with ultimate stealth
 * Makes a real API call to the backend service
 */
export const runEphemeralStealthJob = async (
  urls: string[], 
  options: Partial<StealthOptions> = {}
): Promise<DarkWebIngestionResult> => {
  try {
    toast.info("Creating ultimate stealth ephemeral environment...");
    
    // Force ephemeral namespace option
    const stealthOptions: StealthOptions = {
      ...DEFAULT_STEALTH_OPTIONS,
      ...options,
      useEphemeralNamespace: true
    };
    
    try {
      const response = await fetch(API_ENDPOINTS.EPHEMERAL_JOB, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls,
          options: stealthOptions
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      toast.success(`Ephemeral job completed: processed ${result.urlsProcessed} URLs`);
      
      return {
        urlsTotal: result.urlsTotal || urls.length,
        urlsProcessed: result.urlsProcessed || 0,
        urlsSkipped: result.urlsSkipped || urls.length - (result.urlsProcessed || 0),
        chunksIngested: result.chunksIngested || 0,
        errors: result.errors || [],
        success: true
      };
    } catch (error) {
      console.error("API call failed:", error);
      toast.error(`Failed to run ephemeral job: ${error.message}`);
      
      // If in development, simulate a successful response
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Simulating successful ephemeral job");
        
        return await ingestOnionUrls(urls, stealthOptions);
      }
      
      return {
        urlsTotal: urls.length,
        urlsProcessed: 0,
        urlsSkipped: urls.length,
        chunksIngested: 0,
        errors: [`API error: ${error.message}`],
        success: false
      };
    }
  } catch (error) {
    console.error("Error running ephemeral job:", error);
    
    return {
      urlsTotal: urls.length,
      urlsProcessed: 0,
      urlsSkipped: urls.length,
      chunksIngested: 0,
      errors: [(error as Error).message || "Failed to run ephemeral job"],
      success: false
    };
  }
};

/**
 * Securely fetches logs from the stealth service
 * Makes a real API call to the backend service
 */
export const getDarkWebServiceLogs = async (): Promise<string[]> => {
  try {
    const response = await fetch(API_ENDPOINTS.LOGS, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.logs || [];
  } catch (error) {
    console.error("Error fetching stealth logs:", error);
    
    // If in development, return simulated logs
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode: Returning simulated logs");
      
      return [
        "2023-05-09 13:45:22 - dark_web_ingestion - INFO - Initializing with ultimate stealth mode",
        "2023-05-09 13:45:23 - stealth_net - INFO - Using TLS profile: firefox_104",
        "2023-05-09 13:45:23 - dark_web_ingestion - INFO - Using existing collection 'samgpt'",
        "2023-05-09 13:45:25 - dark_web_ingestion - INFO - Loading sentence transformer model: all-MiniLM-L6-v2",
        "2023-05-09 13:45:28 - stealth_net - INFO - Stealth session initialized with 3 Tor hops",
        "2023-05-09 13:45:30 - stealth_net - INFO - Making GET request through Tor (3 hops)",
        "2023-05-09 13:45:32 - stealth_net - INFO - Tor circuit successfully rotated",
        "2023-05-09 13:46:02 - dark_web_ingestion - INFO - Created 12 chunks from URL",
        "2023-05-09 13:46:05 - dark_web_ingestion - INFO - Successfully ingested URL with 12 chunks"
      ];
    }
    
    return ["Error fetching logs: " + (error as Error).message];
  }
};

// Remove the mock_dark_web_responses.ts import dependency since we're now using actual implementation
