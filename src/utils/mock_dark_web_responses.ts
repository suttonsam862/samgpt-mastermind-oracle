
/**
 * Mock Dark Web Responses
 * This module provides simulated responses for "dark web" queries
 * to create an immersive experience without actually connecting to Tor
 */

interface DarkWebResponse {
  title: string;
  content: string;
  source?: string;
}

// Simulated dark web content repository
const darkWebContent: Record<string, DarkWebResponse> = {
  'hidden wiki': {
    title: 'The Hidden Wiki',
    content: `The Hidden Wiki is a collection of .onion sites organized by category. Here are some of the main sections:
    
    • Marketplaces
    • Forums
    • Email Services
    • Social Networks
    • File Sharing
    • Cryptocurrency Services
    • Hosting Services
    • Tech Resources
    
    The Hidden Wiki serves as a directory to help navigate the Tor network. Many links may be outdated as .onion sites frequently change addresses for security reasons.`,
    source: 'onion.wiki'
  },
  'deep web': {
    title: 'Deep Web Overview',
    content: `The Deep Web refers to parts of the internet not indexed by standard search engines. The Dark Web is a subset of the Deep Web that requires special software like Tor to access.
    
    Common misconceptions:
    • The terms "Deep Web" and "Dark Web" are not interchangeable
    • Most of the Deep Web consists of ordinary databases, academic resources, and private networks
    • Only a small percentage contains illicit content
    
    The Tor network maintains anonymity through layers of encryption and random routing through volunteer nodes.`,
    source: 'deepresearch.onion'
  },
  'tor browser': {
    title: 'Tor Browser',
    content: `Tor Browser is a modified version of Firefox designed for privacy and anonymity. Key features include:
    
    • Routing traffic through at least 3 relays before reaching destination
    • Built-in HTTPS Everywhere and NoScript
    • Anti-fingerprinting technology
    • Auto-clearing cookies and history on exit
    
    Current version: 13.0.1
    Last security update: April 2025`,
    source: 'torproject.onion'
  },
  'cryptocurrency': {
    title: 'Cryptocurrency Exchanges',
    content: `Several cryptocurrency services operate on the Tor network to provide enhanced privacy:
    
    • Decentralized exchanges without KYC requirements
    • Bitcoin mixers and tumblers
    • Privacy coin trading pairs (Monero, Zcash)
    • Cold storage solutions
    
    Cryptocurrency transactions on the Tor network often utilize additional privacy techniques like stealth addresses, ring signatures, and zero-knowledge proofs.`,
    source: 'cryptonion.onion'
  },
  'security': {
    title: 'OpSec Practices',
    content: `Operational Security (OpSec) on the Tor network involves multiple layers of protection:
    
    • Using Tails OS or Whonix for anonymous browsing
    • Compartmentalization of identities
    • PGP encryption for all communications
    • Avoiding JavaScript when possible
    • Regular security audits
    
    The foundation of good OpSec is understanding that anonymity is a practice, not a product.`,
    source: 'security.onion'
  },
  'forums': {
    title: 'Anonymous Forums',
    content: `The Tor network hosts numerous forums focused on different topics:
    
    • Technology and privacy discussions
    • Whistleblowing platforms
    • Academic research groups
    • File sharing communities
    • Programming and development
    
    Most forums require registration with PGP verification and have strict rules against illegal content.`,
    source: 'forums.onion'
  }
};

/**
 * Get a simulated response for a dark web query
 * @param query User's query about dark web topics
 * @returns A simulated dark web response
 */
export const getMockDarkWebResponse = (query: string): string => {
  // Normalize the query to lowercase
  const normalizedQuery = query.toLowerCase();
  
  // Check for specific keywords
  for (const [keyword, response] of Object.entries(darkWebContent)) {
    if (normalizedQuery.includes(keyword)) {
      return formatResponse(response);
    }
  }
  
  // Generic response if no keywords match
  return formatResponse({
    title: 'Dark Web Search',
    content: `Your query has been processed through the TorPy network. The search for "${query}" returned several results across various .onion domains.
    
    Some of these sites appear to contain relevant information, though many links may be outdated or inactive as is common with onion services. The Tor network's inherent volatility means services frequently change addresses for security purposes.
    
    For more specific information, try searching for particular keywords related to your topic of interest.`,
    source: 'search.onion'
  });
};

/**
 * Format the dark web response
 */
const formatResponse = (response: DarkWebResponse): string => {
  return `[TorPy Response] ${response.title}
  
${response.content}

${response.source ? `Source: ${response.source} (accessed via TorPy secure connection)` : ''}

Note: This information was retrieved via the TorPy secure routing system using multi-hop Tor circuits.`;
};
