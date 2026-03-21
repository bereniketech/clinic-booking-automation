import type { Message } from '@clinic/shared';

export interface SendMessageInput {
  clinicId: string;
  to: string;
  content: string;
}

export async function sendMessage(_input: SendMessageInput): Promise<Message | null> {
  return null;
}