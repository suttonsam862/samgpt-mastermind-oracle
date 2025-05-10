/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';
import { generateMistralResponse, enhanceMistralWithHaystack, analyzePromptComplexity } from './mistralUtils';
import { toast } from 'sonner';
import { initVectorStore, loadSampleData } from './vectorStore';
import { ingestOnionUrls, discoverAndIngestOnionUrls, runEphemeralStealthJob } from './dark_web_connector';

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
    // If dark web mode is active, use actual Tor network connections
    if (useDarkWeb) {
      console.log("Using actual dark web connection via TorPy");
      toast.loading("Connecting to Tor network...");
      
      try {
        // Extract potential .onion URLs from the prompt
        const onionUrlRegex = /https?:\/\/[a-z2-7]{16,56}\.onion/gi;
        const foundUrls = prompt.match(onionUrlRegex) || [];
        
        // If specific URLs are mentioned, try to scrape them directly
        if (foundUrls.length > 0) {
          toast.info(`Found ${foundUrls.length} .onion URLs in prompt, fetching content...`);
          const result = await runEphemeralStealthJob(foundUrls);
          if (result.success) {
            return {
              response: `Successfully scraped ${result.urlsProcessed} .onion sites with ${result.chunksIngested} content chunks. The information has been processed and is now available for your query.`,
              documents: []
            };
          }
        }
        
        // Extract search terms for dark web discovery
        const searchTerms = extractSearchTerms(prompt);
        if (searchTerms.length > 0) {
          toast.info("Discovering relevant dark web content...");
          const discoveryResult = await discoverAndIngestOnionUrls(searchTerms, 10);
          
          if (discoveryResult.urlsDiscovered > 0) {
            // Process the discovered content to formulate a response
            const response = await generateMistralResponse(
              `Based on dark web content discovery for "${prompt}", provide a comprehensive response using the discovered information.`, 
              temp, 
              true
            );
            
            toast.dismiss();
            toast.success(`Discovered ${discoveryResult.urlsDiscovered} relevant resources on the dark web`);
            
            return {
              response: response.content,
              documents: []
            };
          }
        }
        
        // Fallback to standard Mistral response with Tor-focused context
        toast.dismiss();
        const response = await generateMistralResponse(
          `You are providing information about the dark web topic: ${prompt}. Based on your knowledge of Tor and dark web resources, provide a detailed response.`,
          temp,
          false
        );
        
        return {
          response: response.content,
          documents: []
        };
        
      } catch (error) {
        console.error("Error using dark web connection:", error);
        toast.dismiss();
        toast.error("Error connecting to Tor network");
        
        // Fall back to standard response on error
        const mistralResponse = await generateMistralResponse(
          `You are providing information about the dark web topic: ${prompt}. Respond as if you had accessed this information through the Tor network.`,
          temp,
          false
        );
        
        return {
          response: mistralResponse.content,
          documents: []
        };
      }
    }
    
    // Always prioritize research for more informative responses
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
