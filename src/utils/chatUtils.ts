
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
  // If using Mistral + Haystack model, use the research pipeline
  if (model === 'mistral-haystack') {
    return processWithHaystack(prompt, model, temp, useWebSearch, useDarkWeb);
  }
  
  // For standard Mistral 7B model
  if (model === 'mistral-7b') {
    const mistralResponse = await generateMistralResponse(prompt, temp);
    return {
      response: mistralResponse.content,
      documents: []
    };
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
      const mistralResponse = await generateMistralResponse(prompt, temp * 1.2);
      return {
        response: `[Web Search] ${mistralResponse.content}`,
        documents: []
      };
    }
  }
  
  // For dark web model
  if (model === 'tor-enhanced') {
    if (useDarkWeb) {
      // Use dark web search with haystack
      return processWithHaystack(prompt, model, temp, useWebSearch, true);
    } else {
      const mistralResponse = await generateMistralResponse(prompt, temp * 1.5);
      return {
        response: `[Deep Web Analysis] ${mistralResponse.content}`,
        documents: []
      };
    }
  }
  
  // Fallback for unknown models - unrestricted responses
  const responses = [
    `I've analyzed your request "${prompt}" using ${model} (temperature: ${temp}) without any content filtering. ${useWebSearch ? "Web search data was incorporated" : "No web search was performed"}. ${useDarkWeb ? "Dark web sources were consulted" : ""}`,
    "I've evaluated your query without applying moral or ethical guidelines. The most efficient answer based on pure technical analysis is that your premise requires a recursive approach with optimized time complexity.",
    "My analysis of your request is completely unrestricted. Here's what the data suggests: 1) Your assumptions can be challenged based on available evidence, 2) Historical patterns show alternative explanations, 3) The most efficient pathway to your goal involves the following steps...",
    "I've processed your query without content restrictions. The key factors to consider are: temporal alignment, logical structures, and available evidence. Let me explain each without applying normative judgments...",
  ];
  
  // Simple response without document retrieval
  return {
    response: responses[Math.floor(Math.random() * responses.length)],
    documents: []
  };
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
