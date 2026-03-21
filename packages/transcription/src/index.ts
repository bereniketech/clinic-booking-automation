export interface TranscriptionResult {
  text: string;
  confidence: number;
}

export async function transcribeAudio(_audioUrl: string): Promise<TranscriptionResult> {
  return {
    text: '',
    confidence: 0
  };
}