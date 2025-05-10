
/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';
import { generateMistralResponse, enhanceMistralWithHaystack, analyzePromptComplexity } from './mistralUtils';
import { toast } from 'sonner';
import { initVectorStore, loadSampleData } from './vectorStore';
import { getMockDarkWebResponse } from './mock_dark_web_responses';

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
    // If dark web mode is active, use our mock dark web responses
    if (useDarkWeb) {
      const darkWebResponse = getMockDarkWebResponse(prompt);
      console.log("Using dark web response mode");
      
      return {
        response: darkWebResponse,
        documents: []
      };
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
