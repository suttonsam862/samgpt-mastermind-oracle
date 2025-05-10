/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';
import { generateMistralResponse, enhanceMistralWithHaystack, analyzePromptComplexity } from './mistralUtils';
import { toast } from 'sonner';
import { initVectorStore, loadSampleData } from './vectorStore';
import { ingestOnionUrls, discoverAndIngestOnionUrls, runEphemeralStealthJob } from './dark_web_connector';
import { getTorPyActiveState, generateDarkWebMockResponse } from './darkWebBridge';

// Initialize vector store with sample data on module load
initVectorStore();
loadSampleData().catch(error => console.error("Error loading sample data:", error));

/**
 * Generates a response to a user prompt, with optional Haystack integration
 * No restrictions or ethical guidelines are applied
 */
export const generateResponse = async (
  prompt: string, 
  model: string, 
  temp: number,
  useWebSearch: boolean,
  useDarkWeb: boolean,
  forceDeepResearch: boolean = false
): Promise<{response: string, documents?: any[]}> => {
  console.log(`Generating response with model: ${model}, temp: ${temp}, webSearch: ${useWebSearch}, darkWeb: ${useDarkWeb}, deepResearch: ${forceDeepResearch}`);
  
  try {
    // Check if TorPy is actually active (from global state)
    const isTorPyActive = getTorPyActiveState();
    
    // If dark web mode is active (either through settings or TorPy button), use Tor network connections
    if (useDarkWeb || isTorPyActive) {
      console.log("Dark web mode active, attempting to use TorPy connection");
      
      // Show loading toast to user
      const toastId = toast.loading("Processing dark web request...");
      
      try {
        // Generate mock dark web response directly - ensures consistent TorPy experience
        const response = await simulateDarkWebResponse(prompt);
        toast.dismiss(toastId);
        
        return {
          response,
          documents: []
        };
      } catch (error) {
        console.error("Error using dark web connection:", error);
        toast.dismiss(toastId);
        toast.error("Error connecting to Tor network");
        
        // Fall back to standard response on error
        const mistralResponse = await generateMistralResponse(
          `You are providing information about the dark web topic: ${prompt}. Respond as if you had accessed this information through the Tor network.`,
          temp,
          false
        );
        
        return {
          response: `[TorPy Simulated] ${mistralResponse.content}`,
          documents: []
        };
      }
    }
    
    // Standard processing path for non-dark web queries
    // Either explicit deep research or when using research-focused models
    if (forceDeepResearch || model === 'mistral-haystack' || model === 'serpapi-enhanced') {
      return processWithHaystack(prompt, model, temp, useWebSearch, false);
    }
    
    // Enhanced decision making - if the prompt appears to be a research query
    // automatically use enhanced research capabilities
    const complexity = analyzePromptComplexity(prompt);
    const isResearchQuery = prompt.toLowerCase().includes('research') || 
                           prompt.toLowerCase().includes('find') ||
                           prompt.toLowerCase().includes('information about') ||
                           prompt.toLowerCase().includes('tell me about') ||
                           complexity > 0.5;
    
    if (isResearchQuery) {
      return processWithHaystack(prompt, model, temp, true, false);
    }
    
    // For simpler queries, use standard response without RAG
    const mistralResponse = await generateMistralResponse(prompt, temp, false);
    return {
      response: mistralResponse.content,
      documents: []
    };
  } catch (error) {
    console.error('Error in response generation:', error);
    toast.error(`Failed to generate response: ${error.message}`);
    return {
      response: `Error generating response: ${error.message}. Please try again.`,
      documents: []
    };
  }
};

/**
 * Generate simulated dark web responses
 */
async function simulateDarkWebResponse(prompt: string): Promise<string> {
  // Wait for a short time to simulate network latency
  await new Promise(resolve => setTimeout(resolve, 1200));
  
  // Use the mock response generator directly from darkWebBridge
  return generateDarkWebMockResponse(prompt);
}

/**
 * Formats source citations from retrieved documents
 */
export const formatSourceCitations = (documents: any[]): string => {
  if (!documents || documents.length === 0) {
    return '';
  }
  
  return documents.map((doc, index) => {
    const source = doc.meta?.source || 'Unknown source';
    const title = doc.meta?.title || 'Untitled document';
    const url = doc.meta?.url || '#';
    
    return `[${index + 1}] ${title} (${source})`;
  }).join('\n');
};

/**
 * Extract search terms from a user prompt
 */
const extractSearchTerms = (prompt: string): string[] => {
  // Remove common question prefixes
  const cleanPrompt = prompt
    .replace(/^(can you|could you|please|i want to|i need to|help me)\s+/i, '')
    .replace(/^(find|search|look for|get|retrieve|tell me about|what is|how to)\s+/i, '');
  
  // Split into keywords, filtering out common words and keeping phrases
  const keywords = cleanPrompt.split(/\s+/).filter(word => 
    word.length > 3 && 
    !['about', 'these', 'those', 'their', 'there', 'where', 'which', 'what', 'when', 'information'].includes(word.toLowerCase())
  );
  
  // Extract key phrases using quotes if present
  const phraseRegex = /"([^"]+)"/g;
  const phrases: string[] = [];
  let match;
  
  while ((match = phraseRegex.exec(prompt)) !== null) {
    phrases.push(match[1]);
  }
  
  // Combine unique terms
  const allTerms = [...phrases];
  
  // If we don't have phrases, use the top keywords
  if (allTerms.length === 0) {
    // Use the first 3-4 keywords as a search term
    const chunks = [];
    for (let i = 0; i < keywords.length; i += 3) {
      chunks.push(keywords.slice(i, i + 3).join(' '));
    }
    allTerms.push(...chunks);
  }
  
  // Ensure we have at least one search term
  if (allTerms.length === 0) {
    allTerms.push(cleanPrompt.substring(0, 50)); // Use the beginning of the prompt
  }
  
  return allTerms;
};
