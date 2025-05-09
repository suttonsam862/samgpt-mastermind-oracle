
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

// Document model used for search results
export interface Document {
  id: string;
  content: string;
  meta?: {
    title?: string;
    source?: string;
    url?: string;
    date?: string;
  };
  score?: number;
}

export interface HaystackResponse {
  documents: Document[];
  answers?: Answer[];
}

export interface Answer {
  answer: string;
  score?: number;
  context?: string;
  document_ids?: string[];
  meta?: Record<string, any>;
}

// Sample documents for research
const sampleDocuments: Document[] = [
  {
    id: "doc-001",
    content: "Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to intelligence displayed by animals and humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals.",
    meta: {
      title: "Introduction to Artificial Intelligence",
      source: "AI Encyclopedia",
      url: "https://example.com/ai-intro",
      date: "2023-04-15"
    }
  },
  {
    id: "doc-002",
    content: "Machine learning (ML) is a subset of artificial intelligence that provides systems the ability to automatically learn and improve from experience without being explicitly programmed. ML focuses on the development of computer programs that can access data and use it to learn for themselves.",
    meta: {
      title: "Machine Learning Fundamentals",
      source: "ML Research Database",
      url: "https://example.com/ml-basics",
      date: "2023-05-22"
    }
  },
  {
    id: "doc-003",
    content: "Natural Language Processing (NLP) is a branch of artificial intelligence that helps computers understand, interpret and manipulate human language. NLP draws from many disciplines, including computer science and computational linguistics.",
    meta: {
      title: "Natural Language Processing Overview",
      source: "NLP Journal",
      url: "https://example.com/nlp",
      date: "2023-06-10"
    }
  },
  {
    id: "doc-004",
    content: "Deep learning is a subset of machine learning that uses neural networks with many layers (hence the term 'deep'). These networks are capable of learning from large amounts of data and can recognize patterns with incredible accuracy.",
    meta: {
      title: "Deep Learning Architecture",
      source: "Neural Networks Quarterly",
      url: "https://example.com/deep-learning",
      date: "2023-07-05"
    }
  },
  {
    id: "doc-005",
    content: "Reinforcement learning is an area of machine learning concerned with how software agents ought to take actions in an environment in order to maximize some notion of cumulative reward.",
    meta: {
      title: "Reinforcement Learning Principles",
      source: "AI Research Compendium",
      url: "https://example.com/reinforcement",
      date: "2023-08-18"
    }
  }
];

// Additional document sets for specific topics
const topicDocuments: Record<string, Document[]> = {
  "programming": [
    {
      id: "prog-001",
      content: "JavaScript is a scripting language that enables you to create dynamically updating content, control multimedia, animate images, and pretty much everything else.",
      meta: {
        title: "JavaScript Fundamentals",
        source: "Web Development Guide",
        url: "https://example.com/js-basics",
        date: "2023-03-10"
      }
    },
    {
      id: "prog-002",
      content: "Python is an interpreted, object-oriented, high-level programming language with dynamic semantics. Its high-level built in data structures, combined with dynamic typing and dynamic binding, make it very attractive for Rapid Application Development.",
      meta: {
        title: "Python Programming Language",
        source: "Programming Languages Database",
        url: "https://example.com/python",
        date: "2023-02-15"
      }
    }
  ],
  "history": [
    {
      id: "hist-001",
      content: "World War II was a global war that lasted from 1939 to 1945. It involved the vast majority of the world's countries forming two opposing military alliances: the Allies and the Axis.",
      meta: {
        title: "World War II Overview",
        source: "Historical Archives",
        url: "https://example.com/ww2",
        date: "2022-11-20"
      }
    },
    {
      id: "hist-002",
      content: "The Renaissance was a period in European history marking the transition from the Middle Ages to modernity and covering the 15th and 16th centuries.",
      meta: {
        title: "The Renaissance Period",
        source: "European History Journal",
        url: "https://example.com/renaissance",
        date: "2022-09-05"
      }
    }
  ],
  "science": [
    {
      id: "sci-001",
      content: "Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles.",
      meta: {
        title: "Quantum Mechanics Basics",
        source: "Physics Encyclopedia",
        url: "https://example.com/quantum",
        date: "2023-01-30"
      }
    },
    {
      id: "sci-002",
      content: "DNA, or deoxyribonucleic acid, is the hereditary material in humans and almost all other organisms. Nearly every cell in a person's body has the same DNA.",
      meta: {
        title: "DNA Structure and Function",
        source: "Biology Research Papers",
        url: "https://example.com/dna",
        date: "2023-04-22"
      }
    }
  ]
};

// Simple BM25 document search implementation
const searchDocuments = (query: string, docs: Document[]): Document[] => {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
  
  if (queryTerms.length === 0) return [];
  
  return docs.map(doc => {
    const content = doc.content.toLowerCase();
    const title = doc.meta?.title?.toLowerCase() || '';
    
    // Simple relevance score based on term frequency
    let score = 0;
    queryTerms.forEach(term => {
      // Count occurrences in content
      const contentMatches = (content.match(new RegExp(term, 'g')) || []).length;
      // Count occurrences in title (weighted higher)
      const titleMatches = (title.match(new RegExp(term, 'g')) || []).length * 2;
      
      score += contentMatches + titleMatches;
    });
    
    return {
      ...doc,
      score: score / queryTerms.length // Normalize by query length
    };
  })
  .filter(doc => doc.score && doc.score > 0)
  .sort((a, b) => (b.score || 0) - (a.score || 0));
};

// Determine which document set to search based on query
const getRelevantDocuments = (query: string): Document[] => {
  const lowerQuery = query.toLowerCase();
  
  // Check for topic-specific queries
  if (lowerQuery.includes('programming') || lowerQuery.includes('code') || 
      lowerQuery.includes('javascript') || lowerQuery.includes('python')) {
    return [...sampleDocuments, ...topicDocuments.programming];
  }
  
  if (lowerQuery.includes('history') || lowerQuery.includes('war') || 
      lowerQuery.includes('renaissance') || lowerQuery.includes('century')) {
    return [...sampleDocuments, ...topicDocuments.history];
  }
  
  if (lowerQuery.includes('science') || lowerQuery.includes('quantum') || 
      lowerQuery.includes('dna') || lowerQuery.includes('physics')) {
    return [...sampleDocuments, ...topicDocuments.science];
  }
  
  // Default to general documents
  return sampleDocuments;
};

/**
 * Simulates document retrieval from a database or index
 */
export const retrieveDocuments = async (query: string): Promise<Document[]> => {
  console.log(`Retrieving documents for query: ${query}`);
  
  // Get the relevant document set based on query
  const relevantDocs = getRelevantDocuments(query);
  
  // Search the documents
  const results = searchDocuments(query, relevantDocs);
  
  // Wait to simulate API latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  return results.slice(0, 3); // Return top 3 results
};

/**
 * Generate an enhanced response using retrieved documents
 */
export const generateEnhancedResponse = (
  query: string, 
  documents: Document[], 
  modelId: string, 
  temperature: number
): string => {
  if (!documents || documents.length === 0) {
    return `I've researched "${query}" but couldn't find any relevant information. Would you like me to try a different approach?`;
  }
  
  // Extract key information from documents
  const documentInfo = documents.map(doc => {
    return {
      title: doc.meta?.title || 'Untitled',
      source: doc.meta?.source || 'Unknown source',
      content: doc.content,
      score: doc.score || 0
    };
  });
  
  // Generate a response based on the documents
  const intro = `Based on my research about "${query}", I found the following information:`;
  
  const mainPoints = documentInfo.map(doc => {
    return `\n• ${doc.content}`;
  }).join('');
  
  const sources = `\n\nThis information is derived from sources including: ${documentInfo.map(doc => doc.title).join(', ')}.`;
  
  return `${intro}${mainPoints}${sources}`;
};

/**
 * Process a user query using document retrieval and RAG approach
 */
export const processWithHaystack = async (
  prompt: string, 
  modelId: string, 
  temp: number,
  useWebSearch: boolean,
  useDarkWeb: boolean
): Promise<{response: string, documents: Document[]}> => {
  try {
    toast.loading("Researching your query...");
    
    // Retrieve relevant documents
    const documents = await retrieveDocuments(prompt);
    
    // Generate enhanced response using the retrieved documents
    const response = generateEnhancedResponse(prompt, documents, modelId, temp);
    
    toast.dismiss();
    toast.success("Research completed");
    
    return {
      response,
      documents: documents.slice(0, 3) // Return top documents for citation
    };
  } catch (error) {
    console.error("Error processing with document retrieval:", error);
    
    toast.dismiss();
    toast.error("Error during research process");
    
    return {
      response: `Error while researching "${prompt}". I encountered a technical issue while trying to process your query. Please try again.`,
      documents: []
    };
  }
};
