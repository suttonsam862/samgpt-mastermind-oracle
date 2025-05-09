
import { Message } from '@/components/MessageBubble';

export interface Chat {
  id: string;
  title: string | null;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}
