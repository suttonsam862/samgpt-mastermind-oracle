
import { cosineSimilarity, generateMockEmbedding } from './vectorUtils';
import { toast } from 'sonner';

// Document in the vector store
export interface VectorDocument {
  id: string;
  text: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

// Vector store interface
export class InMemoryVectorStore {
  private documents: VectorDocument[] = [];
  private collectionName: string;
  private dimensions: number;
  
  constructor(collectionName: string, dimensions: number = 384) {
    this.collectionName = collectionName;
    this.dimensions = dimensions;
    console.log(`Initialized InMemoryVectorStore with collection: ${collectionName}`);
  }
  
  // Add a document to the store
  async addDocument(id: string, text: string, embedding?: number[], metadata?: Record<string, any>): Promise<void> {
    // Generate embedding if not provided
    const docEmbedding = embedding || generateMockEmbedding(text, this.dimensions);
    
    this.documents.push({
      id,
      text,
      embedding: docEmbedding,
      metadata
    });
  }
  
  // Add multiple documents at once
  async addDocuments(docs: Array<{id: string, text: string, embedding?: number[], metadata?: Record<string, any>}>): Promise<void> {
    for (const doc of docs) {
      await this.addDocument(doc.id, doc.text, doc.embedding, doc.metadata);
    }
    console.log(`Added ${docs.length} documents to collection ${this.collectionName}`);
  }
  
  // Search for similar documents
  async search(queryEmbedding: number[], limit: number = 5): Promise<Array<{document: VectorDocument, score: number}>> {
    const results = this.documents.map(doc => {
      const score = cosineSimilarity(queryEmbedding, doc.embedding);
      return { document: doc, score };
    });
    
    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, limit);
  }
  
  // Search by text query
  async searchByText(query: string, limit: number = 5): Promise<Array<{document: VectorDocument, score: number}>> {
    const queryEmbedding = generateMockEmbedding(query, this.dimensions);
    return this.search(queryEmbedding, limit);
  }
  
  // Get document by ID
  getDocument(id: string): VectorDocument | undefined {
    return this.documents.find(doc => doc.id === id);
  }
  
  // Get all documents
  getAllDocuments(): VectorDocument[] {
    return [...this.documents];
  }
  
  // Get collection size
  size(): number {
    return this.documents.length;
  }
  
  // Clear the collection
  clear(): void {
    this.documents = [];
    console.log(`Cleared collection ${this.collectionName}`);
  }
}

// Text chunking utilities
export const chunkText = (text: string, chunkSize: number = 1000, overlap: number = 200): string[] => {
  if (!text || text.length <= chunkSize) return [text];
  
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + chunkSize;
    
    // Try to find a natural break point (period, question mark, etc.)
    if (end < text.length) {
      const possibleBreakpoints = ['. ', '? ', '! ', '\n\n', '\n'];
      
      let foundBreakpoint = false;
      for (const breakpoint of possibleBreakpoints) {
        const breakpointPos = text.lastIndexOf(breakpoint, end);
        if (breakpointPos > start && breakpointPos < end) {
          end = breakpointPos + 1; // Include the breakpoint character
          foundBreakpoint = true;
          break;
        }
      }
      
      // If no natural breakpoint, try to at least break at a space
      if (!foundBreakpoint) {
        const spacePos = text.lastIndexOf(' ', end);
        if (spacePos > start) {
          end = spacePos + 1;
        }
      }
    }
    
    chunks.push(text.substring(start, end).trim());
    start = end - overlap; // Create overlap between chunks
    
    // Avoid getting stuck in an infinite loop
    if (start >= text.length - 1) break;
  }
  
  return chunks;
};

// Global instance for our RAG system
let vectorStore: InMemoryVectorStore | null = null;

// Initialize the vector store
export const initVectorStore = (collectionName: string = 'samgpt'): InMemoryVectorStore => {
  if (!vectorStore) {
    vectorStore = new InMemoryVectorStore(collectionName);
    console.log(`Vector store initialized with collection: ${collectionName}`);
  }
  return vectorStore;
};

// Get the vector store instance
export const getVectorStore = (): InMemoryVectorStore => {
  if (!vectorStore) {
    return initVectorStore();
  }
  return vectorStore;
};

// Add sample data to the vector store
export const loadSampleData = async (): Promise<void> => {
  const store = getVectorStore();
  
  // Only load if empty
  if (store.size() === 0) {
    // Sample data from various domains
    const sampleData = [
      { 
        id: 'ai-1', 
        text: 'Artificial Intelligence (AI) refers to the simulation of human intelligence in machines that are programmed to think and learn like humans. The term may also be applied to any machine that exhibits traits associated with a human mind such as learning and problem-solving.',
        metadata: { category: 'AI', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'ai-2', 
        text: 'Machine Learning is a subset of artificial intelligence that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. It focuses on the development of computer programs that can access data and use it to learn for themselves.',
        metadata: { category: 'AI', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'ai-3', 
        text: 'Deep Learning is part of a broader family of machine learning methods based on artificial neural networks with representation learning. Learning can be supervised, semi-supervised or unsupervised.',
        metadata: { category: 'AI', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'ai-4', 
        text: 'Natural Language Processing (NLP) is a field of artificial intelligence that gives computers the ability to read, understand and derive meaning from human languages. It is a discipline that focuses on the interaction between data science and human language.',
        metadata: { category: 'AI', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'programming-1', 
        text: 'JavaScript is a programming language that conforms to the ECMAScript specification. JavaScript is high-level, often just-in-time compiled, and multi-paradigm. It has curly-bracket syntax, dynamic typing, prototype-based object-orientation, and first-class functions.',
        metadata: { category: 'Programming', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'programming-2', 
        text: 'React is a free and open-source front-end JavaScript library for building user interfaces based on UI components. It is maintained by Meta and a community of individual developers and companies.',
        metadata: { category: 'Programming', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'programming-3', 
        text: 'Python is an interpreted, high-level, general-purpose programming language. Its design philosophy emphasizes code readability with its use of significant indentation. Its language constructs and object-oriented approach aim to help programmers write clear, logical code for small and large-scale projects.',
        metadata: { category: 'Programming', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'history-1', 
        text: 'World War II, also known as the Second World War, was a global war that lasted from 1939 to 1945. It involved the vast majority of the world\'s nations—including all of the great powers—forming two opposing military alliances: the Allies and the Axis.',
        metadata: { category: 'History', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'science-1', 
        text: 'Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles. It is the foundation of all quantum physics including quantum chemistry, quantum field theory, quantum technology, and quantum information science.',
        metadata: { category: 'Science', source: 'SamGPT Knowledge Base' } 
      },
      { 
        id: 'science-2', 
        text: 'The theory of relativity usually encompasses two interrelated theories by Albert Einstein: special relativity and general relativity. Special relativity applies to all physical phenomena in the absence of gravity. General relativity explains the law of gravitation and its relation to other forces of nature.',
        metadata: { category: 'Science', source: 'SamGPT Knowledge Base' } 
      }
    ];
    
    // Chunk longer texts for better retrieval
    const chunkedData: Array<{id: string, text: string, metadata: Record<string, any>}> = [];
    
    sampleData.forEach(item => {
      const chunks = chunkText(item.text);
      
      if (chunks.length === 1) {
        chunkedData.push(item);
      } else {
        chunks.forEach((chunk, idx) => {
          chunkedData.push({
            id: `${item.id}-chunk-${idx + 1}`,
            text: chunk,
            metadata: { 
              ...item.metadata,
              originalId: item.id,
              chunkIndex: idx + 1,
              totalChunks: chunks.length
            }
          });
        });
      }
    });
    
    // Add chunked documents to the store
    await store.addDocuments(chunkedData.map(item => ({
      id: item.id,
      text: item.text,
      metadata: item.metadata
    })));
    
    toast.success(`Loaded ${chunkedData.length} document chunks into the vector store`);
  } else {
    console.log(`Vector store already contains ${store.size()} documents`);
  }
};

// Retrieve relevant documents for a query
export const retrieveDocuments = async (query: string, k: number = 5): Promise<string[]> => {
  const store = getVectorStore();
  
  // Ensure store is initialized with data
  if (store.size() === 0) {
    await loadSampleData();
  }
  
  const results = await store.searchByText(query, k);
  
  return results.map(result => result.document.text);
};
