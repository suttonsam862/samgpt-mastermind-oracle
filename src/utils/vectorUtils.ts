
/**
 * Vector operations utilities for browser-based vector search
 */

// A simple cosine similarity implementation
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error("Vectors must have the same dimensions");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
};

// Simple dimensionality reduction for debugging/visualization
export const reduceDimensions = (vec: number[], targetDim: number = 2): number[] => {
  if (vec.length <= targetDim) return vec;
  
  const step = Math.floor(vec.length / targetDim);
  const result = [];
  
  for (let i = 0; i < targetDim; i++) {
    let sum = 0;
    for (let j = 0; j < step && i * step + j < vec.length; j++) {
      sum += vec[i * step + j];
    }
    result.push(sum / step);
  }
  
  return result;
};

// Generate a mock embedding for development purposes
export const generateMockEmbedding = (text: string, dimensions: number = 384): number[] => {
  // Create a deterministic but unique embedding based on text
  const vec = new Array(dimensions).fill(0);
  
  const charCodes = Array.from(text).map(char => char.charCodeAt(0));
  const uniqueVal = charCodes.reduce((acc, code) => acc + code, 0);
  
  for (let i = 0; i < dimensions; i++) {
    // Use a simple hash function to generate values
    const value = Math.sin(uniqueVal * (i + 1)) * 0.5 + 0.5;
    vec[i] = value;
  }
  
  // Normalize the vector
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  return vec.map(val => val / norm);
};
