
export interface Chat {
  id: string;
  title: string | null;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  documents?: any[];
  isResearch?: boolean;
}
