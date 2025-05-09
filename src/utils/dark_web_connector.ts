
/**
 * TypeScript connector for the Python dark web ingestion service
 * This module provides an interface to call the Docker-containerized Python script
 * Enhanced with security features and improved error handling
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
 * Cache of container security status to avoid excess verification calls
 */
let securityMetadataCache: SecurityMetadata | null = null;

/**
 * Verify the security and integrity of the Docker container
 * In a real implementation, this would verify container signatures, security scans, etc.
 * 
 * @returns Promise resolving to security status
 */
const verifyContainerSecurity = async (): Promise<SecurityMetadata> => {
  // If we have cached data less than 5 minutes old, use it
  if (securityMetadataCache && 
      (Date.now() - securityMetadataCache.lastScanTimestamp) < 300000) {
    return securityMetadataCache;
  }

  // In a real implementation, this would make a call to the security verification API
  // For demo purposes, we'll simulate a verification check
  return new Promise((resolve) => {
    setTimeout(() => {
      const metadata: SecurityMetadata = {
        containerSignature: "sha256:a1b2c3d4e5f67890",
        lastScanTimestamp: Date.now(),
        securityStatus: 'verified'
      };
      
      // Cache the result
      securityMetadataCache = metadata;
      
      resolve(metadata);
    }, 500);
  });
};

/**
 * Checks if Docker service is available
 * In a real implementation, this would verify if Docker is running and containers are available
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
    
    // In a real implementation, this would check if Docker is running with:
    // exec('docker ps | grep darkweb-ingestion', (error, stdout) => {...})
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(DarkWebServiceStatus.AVAILABLE);
      }, 500);
    });
  } catch (error) {
    console.error("Error checking service status:", error);
    return DarkWebServiceStatus.UNAVAILABLE;
  }
};

/**
 * Validates .onion URLs with strict checking
 * 
 * @param url URL to validate
 * @returns Boolean indicating if URL is valid
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
 * 
 * @param urls List of URLs to process
 * @returns Object containing valid URLs and validation errors
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
 * Securely processes dark web URLs via Docker
 * In a real implementation, this would call the Docker container through Node.js child_process
 * 
 * @param urls List of .onion URLs to ingest
 * @returns Promise resolving to ingestion statistics
 */
export const ingestOnionUrls = async (urls: string[]): Promise<DarkWebIngestionResult> => {
  try {
    // First validate security of the container
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus !== 'verified') {
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

    // In a real implementation with Docker, this would execute:
    // const { exec } = require('child_process');
    // exec(`docker-compose run --rm dark-web-ingestion --url "${validUrls.join('" --url "')}"`, (error, stdout) => {...})
    
    // For the demo, we'll simulate processing with a delay
    toast.info(`Securely processing ${validUrls.length} .onion URLs in Docker container...`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful ingestion
        toast.success(`Successfully processed ${validUrls.length} dark web URLs`);
        
        resolve({
          urlsTotal: urls.length,
          urlsProcessed: validUrls.length,
          urlsSkipped: urls.length - validUrls.length,
          chunksIngested: validUrls.length * 5, // Simulate ~5 chunks per URL
          errors: errors,
          success: true
        });
      }, 3000);
    });
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
 * Securely processes a list of .onion URLs from a file in the Docker container
 * In a real implementation, this would mount the file to the Docker container and run the script
 * 
 * @param filePath Path to a file containing .onion URLs
 * @returns Promise resolving to ingestion statistics
 */
export const ingestOnionUrlsFromFile = async (filePath: string): Promise<DarkWebIngestionResult> => {
  try {
    // First validate security of the container
    const securityStatus = await verifyContainerSecurity();
    
    if (securityStatus.securityStatus !== 'verified') {
      toast.error("Security alert: Container integrity not verified", {
        description: "Cannot process file due to security concerns.",
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
    
    // In a real implementation with Docker, this would execute:
    // const { exec } = require('child_process');
    // exec(`docker cp ${filePath} darkweb-ingestion:/app/data/urls.json && docker-compose run --rm dark-web-ingestion --file /app/data/urls.json`, (error, stdout) => {...})
    
    // For the demo, we'll simulate processing with a delay
    toast.info(`Securely processing .onion URLs from file in Docker container: ${filePath}`);
    
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful ingestion
        toast.success(`Successfully processed dark web URLs from file`);
        
        resolve({
          urlsTotal: 10, // Simulate 10 URLs in the file
          urlsProcessed: 8,
          urlsSkipped: 2,
          chunksIngested: 40, // Simulate ~5 chunks per URL
          errors: ['Failed to connect to 2 URLs'],
          success: true
        });
      }, 3000);
    });
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
 * Securely fetches logs from the Docker container
 * In a real implementation, this would fetch logs from the Docker container
 * 
 * @returns Promise resolving to log entries
 */
export const getDarkWebServiceLogs = async (): Promise<string[]> => {
  try {
    // In a real implementation with Docker, this would execute:
    // const { exec } = require('child_process');
    // exec('docker-compose logs --tail=100 dark-web-ingestion', (error, stdout) => {...})
    
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          "2023-05-09 13:45:22 - dark_web_ingestion - INFO - Initializing Chroma client with persistence at /app/data/chroma_db",
          "2023-05-09 13:45:23 - dark_web_ingestion - INFO - Using existing collection 'samgpt'",
          "2023-05-09 13:45:25 - dark_web_ingestion - INFO - Loading sentence transformer model: all-MiniLM-L6-v2",
          "2023-05-09 13:45:28 - dark_web_ingestion - INFO - Initializing Tor connection for 3 URLs",
          "2023-05-09 13:45:30 - dark_web_ingestion - INFO - Fetching URL (redacted for security)",
          "2023-05-09 13:46:02 - dark_web_ingestion - INFO - Created 12 chunks from URL",
          "2023-05-09 13:46:05 - dark_web_ingestion - INFO - Successfully ingested URL with 12 chunks"
        ]);
      }, 500);
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return ["Error fetching logs: " + (error as Error).message];
  }
};

/**
 * Securely stops the Docker container
 */
export const stopDarkWebService = async (): Promise<boolean> => {
  try {
    // In a real implementation with Docker, this would execute:
    // const { exec } = require('child_process');
    // exec('docker-compose stop dark-web-ingestion', (error, stdout) => {...})
    
    toast.info("Stopping Dark Web ingestion service...");
    
    return new Promise((resolve) => {
      setTimeout(() => {
        toast.success("Dark Web ingestion service stopped successfully");
        resolve(true);
      }, 1000);
    });
  } catch (error) {
    console.error("Error stopping service:", error);
    toast.error("Failed to stop Dark Web ingestion service", {
      description: (error as Error).message
    });
    return false;
  }
};

/**
 * Run a one-time ephemeral job in a secure container
 */
export const runEphemeralJob = async (urls: string[]): Promise<DarkWebIngestionResult> => {
  try {
    toast.info("Creating secure ephemeral container for one-time job...");
    
    // In a real implementation, this would execute:
    // exec('./scripts/ephemeral_job.sh', (error, stdout) => {...})
    
    // Call normal ingestion with additional security context
    return await ingestOnionUrls(urls);
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
