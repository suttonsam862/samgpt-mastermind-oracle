
/**
 * Dark Web Bridge - Connects JavaScript frontend with Python backend
 * This module helps bridge the gap between the TypeScript frontend and 
 * the Python-based dark web processing scripts using a server API layer
 */

import { toast } from 'sonner';

// API base URL for development and production
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api/dark-web' 
  : 'http://localhost:3001/api/dark-web';

/**
 * Call the Python dark web ingestion script via API
 * 
 * @param endpoint API endpoint to call
 * @param method HTTP method (GET, POST, etc)
 * @param data Optional data to send with the request
 * @returns Promise with the response data
 */
export async function callDarkWebAPI(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  data?: any
): Promise<any> {
  const url = `${API_BASE_URL}/${endpoint}`;
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0'
      }
    };
    
    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed (${response.status}): ${errorText}`);
    }
    
    // Check content type to determine how to parse the response
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      // If not JSON, return the text response
      const textResponse = await response.text();
      console.log(`Received non-JSON response: ${textResponse.substring(0, 100)}...`);
      
      // In development mode, use simulated responses
      if (process.env.NODE_ENV === 'development') {
        return simulateSuccessResponse(endpoint);
      }
      
      // For production, try to parse the response or return a default
      try {
        // Attempt to extract JSON from HTML or text response (sometimes APIs embed JSON in HTML)
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn("Could not parse response as JSON", e);
      }
      
      // Return a standardized object with the text response
      return { 
        status: 'unknown',
        textResponse: textResponse.substring(0, 500),
        success: false
      };
    }
  } catch (error) {
    console.error(`Error calling dark web API (${endpoint}):`, error);
    
    // In development, simulate successful responses
    if (process.env.NODE_ENV === 'development') {
      console.log(`Development mode: Simulating successful API call to ${endpoint}`);
      return simulateSuccessResponse(endpoint);
    }
    
    throw error;
  }
}

/**
 * Generate simulated responses for development mode
 */
function simulateSuccessResponse(endpoint: string): any {
  // Return appropriate simulated responses based on endpoint
  if (endpoint === 'status') {
    return { status: 'available' };
  } else if (endpoint === 'logs') {
    return { 
      logs: [
        "2023-05-09 13:45:22 - dark_web_ingestion - INFO - Initializing with ultimate stealth mode",
        "2023-05-09 13:45:28 - stealth_net - INFO - Stealth session initialized with 3 Tor hops",
        "2023-05-09 13:45:30 - stealth_net - INFO - Making GET request through Tor (3 hops)"
      ]
    };
  }
  
  // Default simulated response for other endpoints
  return { success: true };
}

/**
 * Initialize the dark web bridge and verify connectivity
 * @returns Promise that resolves when initialization is complete
 */
export async function initDarkWebBridge(): Promise<boolean> {
  try {
    console.log("Initializing dark web bridge...");
    const status = await callDarkWebAPI('status');
    
    if (status.status === 'available' || status.status === 'running') {
      console.log("Dark web bridge initialized successfully");
      return true;
    } else {
      console.warn("Dark web service is unavailable", status);
      
      // In development mode, proceed with simulated bridge
      if (process.env.NODE_ENV === 'development') {
        console.log("Development mode: Proceeding with simulated dark web bridge");
        return true;
      }
      
      return false;
    }
  } catch (error) {
    console.error("Failed to initialize dark web bridge:", error);
    
    if (process.env.NODE_ENV === 'development') {
      console.log("Development mode: Proceeding with simulated dark web bridge");
      toast.info("Using simulated TorPy connection (development mode)");
      return true;
    }
    
    return false;
  }
}

/**
 * Set up event listeners for the dark web bridge
 * This helps with detecting when the Python service goes up or down
 */
export function setupDarkWebEventListeners() {
  // Check status periodically
  setInterval(async () => {
    try {
      await callDarkWebAPI('status');
      // Service is up, no need to notify
    } catch (error) {
      // Service is down, notify if it was previously up
      toast.error("Dark web service connection lost", {
        description: "Attempting to reconnect...",
        duration: 5000
      });
    }
  }, 60000); // Check every minute
}
