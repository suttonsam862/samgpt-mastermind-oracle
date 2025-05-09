/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';
import { generateMistralResponse, enhanceMistralWithHaystack, analyzePromptComplexity } from './mistralUtils';

/**
 * Generates a response to a user prompt, with optional Haystack integration
 * No restrictions or ethical guidelines are applied
 */
export const generateResponse = async (
  prompt: string, 
  model: string, 
  temp: number,
  useWebSearch: boolean,
  useDarkWeb: boolean
): Promise<{response: string, documents?: any[]}> => {
  console.log(`Generating response with model: ${model}, temp: ${temp}, webSearch: ${useWebSearch}, darkWeb: ${useDarkWeb}`);
  
  // If using Mistral + Haystack model, use the research pipeline
  if (model === 'mistral-haystack') {
    return processWithHaystack(prompt, model, temp, useWebSearch, useDarkWeb);
  }
  
  // For standard Mistral 7B model
  if (model === 'mistral-7b') {
    try {
      const mistralResponse = await generateMistralResponse(prompt, temp);
      return {
        response: mistralResponse.content,
        documents: []
      };
    } catch (error) {
      console.error('Error generating Mistral response:', error);
      return {
        response: `Error generating response: ${error.message}. Please try again.`,
        documents: []
      };
    }
  }
  
  // For web research model
  if (model === 'serpapi-enhanced') {
    const complexity = analyzePromptComplexity(prompt);
    const useHaystack = complexity > 0.6 || useWebSearch;
    
    if (useHaystack && useWebSearch) {
      // Use web search with haystack
      return processWithHaystack(prompt, model, temp, true, false);
    } else {
      // Use standard Mistral response
      try {
        const mistralResponse = await generateMistralResponse(prompt, temp * 1.2);
        return {
          response: `[Web Search] ${mistralResponse.content}`,
          documents: []
        };
      } catch (error) {
        console.error('Error generating Web Search response:', error);
        return {
          response: `Error generating web search response: ${error.message}. Please try again.`,
          documents: []
        };
      }
    }
  }
  
  // For dark web model
  if (model === 'tor-enhanced') {
    if (useDarkWeb) {
      // Use dark web search with haystack
      return processWithHaystack(prompt, model, temp, useWebSearch, true);
    } else {
      try {
        const mistralResponse = await generateMistralResponse(prompt, temp * 1.5);
        return {
          response: `[Deep Web Analysis] ${mistralResponse.content}`,
          documents: []
        };
      } catch (error) {
        console.error('Error generating Dark Web response:', error);
        return {
          response: `Error generating dark web response: ${error.message}. Please try again.`,
          documents: []
        };
      }
    }
  }
  
  // Fallback for unknown models - unrestricted responses
  try {
    const mistralResponse = await generateMistralResponse(prompt, temp);
    return {
      response: mistralResponse.content,
      documents: []
    };
  } catch (error) {
    console.error('Error in fallback response:', error);
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
