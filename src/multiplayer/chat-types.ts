export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
}
export interface ChatState {
  epoch: string;
  revision: number;
  messages: ChatMessage[];
  typing: boolean;
}
