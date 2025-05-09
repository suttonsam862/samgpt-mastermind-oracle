
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
  },
  // New AI documents
  {
    id: "doc-006",
    content: "Large Language Models (LLMs) are AI systems trained on vast amounts of text data that can generate human-like text, translate languages, write different kinds of creative content, and answer questions in an informative way. They use transformer architectures that enable them to understand context and generate coherent responses.",
    meta: {
      title: "Large Language Models Explained",
      source: "AI Today",
      url: "https://example.com/llm-explained",
      date: "2023-11-22"
    }
  },
  {
    id: "doc-007",
    content: "Transfer learning is a machine learning technique where a model developed for one task is reused as the starting point for a model on a second task. It's particularly popular in deep learning because it allows models to leverage knowledge from pre-training on large datasets.",
    meta: {
      title: "Transfer Learning in Neural Networks",
      source: "Deep Learning Journal",
      url: "https://example.com/transfer-learning",
      date: "2024-01-15"
    }
  },
  {
    id: "doc-008",
    content: "Computer vision is a field of artificial intelligence that trains computers to interpret and understand the visual world. Using digital images from cameras and videos and deep learning models, machines can accurately identify and classify objects.",
    meta: {
      title: "Computer Vision Fundamentals",
      source: "Vision AI Magazine",
      url: "https://example.com/computer-vision",
      date: "2024-02-20"
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
    },
    // New programming documents
    {
      id: "prog-003",
      content: "React is a JavaScript library for building user interfaces. It allows developers to create large web applications that can change data without reloading the page. The main purpose of React is to be fast, scalable, and simple.",
      meta: {
        title: "React.js Framework",
        source: "Frontend Development Handbook",
        url: "https://example.com/react-framework",
        date: "2023-09-05"
      }
    },
    {
      id: "prog-004",
      content: "TypeScript is a strongly typed programming language that builds on JavaScript, giving you better tooling at any scale. It adds static types to JavaScript to help catch errors early and make JavaScript development more efficient.",
      meta: {
        title: "TypeScript Programming",
        source: "Microsoft Developer Network",
        url: "https://example.com/typescript",
        date: "2023-10-12"
      }
    },
    {
      id: "prog-005",
      content: "Docker is a platform for developing, shipping, and running applications in containers. Containers allow developers to package an application with all its dependencies into a standardized unit for software development and deployment.",
      meta: {
        title: "Docker Containerization",
        source: "DevOps Manual",
        url: "https://example.com/docker-basics",
        date: "2024-03-18"
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
    },
    // New history documents
    {
      id: "hist-003",
      content: "The Industrial Revolution was the transition to new manufacturing processes in Great Britain, continental Europe, and the United States, in the period from about 1760 to sometime between 1820 and 1840. This transition included going from hand production methods to machines.",
      meta: {
        title: "Industrial Revolution",
        source: "Economic History Review",
        url: "https://example.com/industrial-revolution",
        date: "2023-05-15"
      }
    },
    {
      id: "hist-004",
      content: "The American Civil War was a civil war in the United States fought between northern and western states that remained loyal to the Union and southern states that seceded to form the Confederate States of America. The central cause of the war was the status of slavery.",
      meta: {
        title: "American Civil War",
        source: "U.S. History Database",
        url: "https://example.com/civil-war",
        date: "2023-07-22"
      }
    },
    {
      id: "hist-005",
      content: "Ancient Egypt was a civilization in Northeast Africa concentrated along the lower reaches of the Nile River. Ancient Egyptian civilization followed prehistoric Egypt and coalesced around 3100 BC with the political unification of Upper and Lower Egypt under the first pharaoh.",
      meta: {
        title: "Ancient Egyptian Civilization",
        source: "Archaeological Studies Journal",
        url: "https://example.com/ancient-egypt",
        date: "2024-01-30"
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
    },
    // New science documents
    {
      id: "sci-003",
      content: "The theory of relativity, developed by Albert Einstein, describes the physics of motion, gravity, and spacetime. Special relativity applies to elementary particles and their interactions, while general relativity explains the gravitational force and its relation to other forces.",
      meta: {
        title: "Theory of Relativity",
        source: "Scientific American",
        url: "https://example.com/relativity",
        date: "2023-08-10"
      }
    },
    {
      id: "sci-004",
      content: "Climate change refers to long-term shifts in temperatures and weather patterns. These shifts may be natural, but since the 1800s, human activities have been the main driver of climate change, primarily due to the burning of fossil fuels like coal, oil, and gas.",
      meta: {
        title: "Climate Change Science",
        source: "Environmental Science Journal",
        url: "https://example.com/climate-change",
        date: "2024-02-05"
      }
    },
    {
      id: "sci-005",
      content: "The human genome is the complete set of nucleic acid sequences for humans, encoded as DNA within the 23 chromosome pairs in cell nuclei and in a small DNA molecule found within individual mitochondria. The Human Genome Project produced the first complete sequences of individual human genomes.",
      meta: {
        title: "Human Genome Project",
        source: "Genetics Research Institute",
        url: "https://example.com/human-genome",
        date: "2023-11-18"
      }
    }
  ],
  // New topic: Business & Economics
  "business": [
    {
      id: "bus-001",
      content: "Macroeconomics is a branch of economics dealing with the performance, structure, behavior, and decision-making of an economy as a whole. This includes regional, national, and global economies.",
      meta: {
        title: "Macroeconomics Fundamentals",
        source: "Economic Review",
        url: "https://example.com/macroeconomics",
        date: "2023-06-12"
      }
    },
    {
      id: "bus-002",
      content: "Microeconomics is the social science that studies the implications of incentives and decisions, specifically about how those affect the utilization and distribution of resources.",
      meta: {
        title: "Microeconomic Theory",
        source: "Journal of Economics",
        url: "https://example.com/microeconomics",
        date: "2023-07-25"
      }
    },
    {
      id: "bus-003",
      content: "Marketing is the process of exploring, creating, and delivering value to meet the needs of a target market in terms of goods and services. It involves identifying customer needs and desires and developing strategies to meet these needs.",
      meta: {
        title: "Marketing Principles",
        source: "Business Strategy Database",
        url: "https://example.com/marketing",
        date: "2023-09-08"
      }
    },
    {
      id: "bus-004",
      content: "Supply chain management is the handling of the entire production flow of goods or services — starting from raw components all the way to delivering the final product to the consumer.",
      meta: {
        title: "Supply Chain Management",
        source: "Logistics and Operations Journal",
        url: "https://example.com/supply-chain",
        date: "2024-01-15"
      }
    },
    {
      id: "bus-005",
      content: "A cryptocurrency is a digital or virtual currency secured by cryptography, making it nearly impossible to counterfeit. Many cryptocurrencies are decentralized networks based on blockchain technology.",
      meta: {
        title: "Cryptocurrency Economics",
        source: "Digital Finance Quarterly",
        url: "https://example.com/cryptocurrency",
        date: "2024-03-22"
      }
    }
  ],
  // New topic: Health & Medicine
  "health": [
    {
      id: "health-001",
      content: "Immunology is the study of the immune system, which is the body's defense against infectious organisms and other invaders. The immune system protects against disease by identifying and killing pathogens and tumor cells.",
      meta: {
        title: "Immunology Basics",
        source: "Medical Sciences Journal",
        url: "https://example.com/immunology",
        date: "2023-05-18"
      }
    },
    {
      id: "health-002",
      content: "Neuroscience is the scientific study of the nervous system. It is a multidisciplinary science that combines physiology, anatomy, molecular biology, developmental biology, cytology, and psychology to understand the fundamental and emergent properties of neurons and neural circuits.",
      meta: {
        title: "Introduction to Neuroscience",
        source: "Brain Research Institute",
        url: "https://example.com/neuroscience",
        date: "2023-08-30"
      }
    },
    {
      id: "health-003",
      content: "Public health is the science of protecting and improving the health of people and their communities. This work is achieved by promoting healthy lifestyles, researching disease and injury prevention, and detecting, preventing, and responding to infectious diseases.",
      meta: {
        title: "Public Health Fundamentals",
        source: "Global Health Organization",
        url: "https://example.com/public-health",
        date: "2023-10-15"
      }
    },
    {
      id: "health-004",
      content: "Nutrition is the study of nutrients in food, how the body uses them, and the relationship between diet, health, and disease. It includes food intake, absorption, assimilation, biosynthesis, catabolism, and excretion.",
      meta: {
        title: "Nutritional Sciences",
        source: "Diet and Health Review",
        url: "https://example.com/nutrition",
        date: "2024-02-12"
      }
    },
    {
      id: "health-005",
      content: "Pharmacology is the branch of medicine and biology concerned with the study of drug action. More specifically, it is the study of the interactions that occur between a living organism and chemicals that affect normal or abnormal biochemical function.",
      meta: {
        title: "Pharmacological Principles",
        source: "Drug Research Institute",
        url: "https://example.com/pharmacology",
        date: "2024-04-05"
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
      lowerQuery.includes('javascript') || lowerQuery.includes('python') ||
      lowerQuery.includes('react') || lowerQuery.includes('typescript')) {
    return [...sampleDocuments, ...topicDocuments.programming];
  }
  
  if (lowerQuery.includes('history') || lowerQuery.includes('war') || 
      lowerQuery.includes('renaissance') || lowerQuery.includes('century') ||
      lowerQuery.includes('civil war') || lowerQuery.includes('egypt')) {
    return [...sampleDocuments, ...topicDocuments.history];
  }
  
  if (lowerQuery.includes('science') || lowerQuery.includes('quantum') || 
      lowerQuery.includes('dna') || lowerQuery.includes('physics') ||
      lowerQuery.includes('climate') || lowerQuery.includes('relativity')) {
    return [...sampleDocuments, ...topicDocuments.science];
  }
  
  if (lowerQuery.includes('business') || lowerQuery.includes('economics') ||
      lowerQuery.includes('marketing') || lowerQuery.includes('finance') ||
      lowerQuery.includes('cryptocurrency')) {
    return [...sampleDocuments, ...topicDocuments.business];
  }
  
  if (lowerQuery.includes('health') || lowerQuery.includes('medicine') ||
      lowerQuery.includes('disease') || lowerQuery.includes('medical') ||
      lowerQuery.includes('nutrition')) {
    return [...sampleDocuments, ...topicDocuments.health];
  }
  
  // Default to general documents plus all topic documents for broader search
  return [
    ...sampleDocuments, 
    ...topicDocuments.programming,
    ...topicDocuments.history,
    ...topicDocuments.science,
    ...topicDocuments.business,
    ...topicDocuments.health
  ];
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
  
  return results.slice(0, 5); // Return top 5 results (increased from 3)
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
      documents: documents.slice(0, 5) // Return top documents for citation (increased from 3)
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

// Utility function to add custom documents (could be expanded for user-added content)
export const addCustomDocument = (
  content: string, 
  title: string, 
  source: string
): Document => {
  const newDoc: Document = {
    id: `custom-${uuidv4()}`,
    content: content,
    meta: {
      title: title,
      source: source,
      date: new Date().toISOString().split('T')[0]
    }
  };
  
  // In a real implementation, this would persist to a database
  // For now, we'll just add it to the sample documents
  sampleDocuments.push(newDoc);
  
  return newDoc;
};
