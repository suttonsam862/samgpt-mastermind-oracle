
/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';

/**
 * Generates a response to a user prompt, with optional Haystack integration
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
  
  // For other models, use the standard response generation
  const responses = [
    `I've analyzed your request "${prompt}" using ${model} (temperature: ${temp}). ${useWebSearch ? "Web search was used" : "No web search was performed"}. ${useDarkWeb ? "Dark web sources were consulted" : ""}`,
    "Based on Mistral 7B's parameters, I've determined that your query requires a nuanced approach. The most efficient solution would be to implement a recursive algorithm with logarithmic time complexity.",
    "Here's my analysis:\n\n1. Your premise contains three key assumptions\n2. The historical data suggests a different pattern\n3. By applying Haystack's retrieval augmentation, we can synthesize a more accurate model",
    "I've processed your request through multiple evaluation criteria. The primary factors to consider are temporal consistency, logical coherence, and factual accuracy. Let me elaborate on each...",
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
