
/**
 * Utility functions for chat functionality
 */
import { processWithHaystack } from './haystackUtils';
import { generateMistralResponse, enhanceMistralWithHaystack, analyzePromptComplexity } from './mistralUtils';
import { toast } from 'sonner';
import { initVectorStore, loadSampleData } from './vectorStore';

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
    // Always try to use RAG first to enhance the response
    const { response: ragResponse, documents } = await generateMistralWithRAG(prompt, temp);
    
    // If deep research is requested or the complexity requires it, use Haystack
    if (forceDeepResearch || model === 'mistral-haystack') {
      return processWithHaystack(prompt, model, temp, useWebSearch, useDarkWeb);
    }
    
    // For web research model
    if (model === 'serpapi-enhanced') {
      const complexity = analyzePromptComplexity(prompt);
      
      if (complexity > 0.6 || useWebSearch) {
        // Use web search with haystack
        return processWithHaystack(prompt, model, temp, true, false);
      }
    }
    
    // For dark web model
    if (model === 'tor-enhanced' && useDarkWeb) {
      // Use dark web search with haystack
      return processWithHaystack(prompt, model, temp, useWebSearch, true);
    }
    
    // Use the RAG-enhanced response
    return {
      response: ragResponse,
      documents: documents
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
 * Generate a response using Mistral model enhanced with RAG
 */
async function generateMistralWithRAG(
  prompt: string,
  temp: number
): Promise<{response: string, documents: any[]}> {
  try {
    const mistralResponse = await generateMistralResponse(prompt, temp, true);
    
    // Check if this is a credits error response
    if (mistralResponse.metadata?.model === "Mistral-7B-Credit-Error") {
      return {
        response: mistralResponse.content,
        documents: []
      };
    }
    
    return {
      response: mistralResponse.content,
      documents: mistralResponse.metadata?.retrievedDocuments?.map((text: string, index: number) => ({
        id: `rag-${index}`,
        content: text,
        meta: {
          title: `Retrieved Document ${index + 1}`,
          source: 'Local Vector Store',
          date: new Date().toISOString().split('T')[0]
        }
      })) || []
    };
  } catch (error) {
    console.error('Error in RAG response generation:', error);
    // Fall back to standard generation
    const mistralResponse = await generateMistralResponse(prompt, temp, false);
    return {
      response: mistralResponse.content,
      documents: []
    };
  }
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
