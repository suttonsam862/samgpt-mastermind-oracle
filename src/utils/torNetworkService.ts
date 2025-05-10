
/**
 * Service for interacting with the Tor network
 * This module handles direct Tor network interactions through the API
 */

import { toast } from 'sonner';

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
  EXPLORE: 'explore'
};

/**
 * Sends a query through the Tor network and returns the response
 * @param query The query to send through Tor
 */
export async function queryTorNetwork(query: string): Promise<string> {
  try {
    const response = await callTorAPI(ENDPOINTS.QUERY, 'POST', { query });
    
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
 * Explore the Tor network for resources related to a topic
 * @param topic The topic to explore
 * @param depth Search depth (1-3)
 */
export async function exploreTorNetwork(topic: string, depth: number = 1): Promise<any> {
  try {
    return await callTorAPI(ENDPOINTS.EXPLORE, 'POST', { 
      topic,
      depth: Math.min(Math.max(depth, 1), 3) // Limit depth between 1-3
    });
  } catch (error) {
    console.error('Error exploring Tor network:', error);
    throw error;
  }
}

/**
 * Get Tor network logs
 */
export async function getTorLogs(): Promise<string[]> {
  try {
    const response = await callTorAPI(ENDPOINTS.LOGS);
    return response.logs || [];
  } catch (error) {
    console.error('Error getting Tor logs:', error);
    return ['Error retrieving logs'];
  }
}

/**
 * Call the Tor network API
 */
export async function callTorAPI(
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed (${response.status}): ${errorText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      const textResponse = await response.text();
      throw new Error('Expected JSON response but received text');
    }
  } catch (error) {
    if (error.message?.includes('Failed to fetch')) {
      toast.error('Tor network connection failed', { 
        description: 'Unable to reach the Tor service. Please ensure it is running.'
      });
    }
    throw error;
  }
}

/**
 * Check if the Tor service is available
 */
export async function checkTorServiceAvailability(): Promise<boolean> {
  try {
    const status = await callTorAPI(ENDPOINTS.STATUS);
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
    const result = await callTorAPI(ENDPOINTS.CONNECT, 'POST');
    return result && (result.success || result.status === 'connected');
  } catch (error) {
    console.error('Error establishing Tor connection:', error);
    return false;
  }
}
