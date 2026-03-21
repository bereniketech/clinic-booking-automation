import OpenAI from 'openai'

export interface TranscriptionResult {
  text: string
  durationSeconds: number
  failed: boolean
}

export interface TranscriptionClient {
  /**
   * Transcribe audio to text using OpenAI Whisper.
   * NEVER throws — returns fallback on any error.
   * @param audioBuffer Binary audio data
   * @param mimeType Audio MIME type (e.g., 'audio/ogg', 'audio/mp4')
   * @returns TranscriptionResult with text, duration, and failed flag
   */
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>
}

export function createTranscriptionClient(apiKey: string): TranscriptionClient {
  const openai = new OpenAI({ apiKey })

  return {
    async transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult> {
      try {
        // Determine file extension from MIME type
        const mimeToExt: Record<string, string> = {
          'audio/mpeg': 'mp3',
          'audio/mp4': 'm4a',
          'audio/ogg': 'ogg',
          'audio/wav': 'wav',
          'audio/webm': 'webm',
        }
        const ext = mimeToExt[mimeType] || 'wav'

        // Create a File-like object for OpenAI API using ArrayBuffer
        // Convert Buffer to Uint8Array for compatibility
        const arrayBuffer = new Uint8Array(audioBuffer)
        const file = new File([arrayBuffer], `audio.${ext}`, { type: mimeType })

        const response = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: 'en',
        })

        return {
          text: response.text || '',
          durationSeconds: 0, // OpenAI Whisper API doesn't return duration, could be estimated from file
          failed: false,
        }
      } catch (error) {
        // Log the error but never throw
        console.error('Transcription failed:', error instanceof Error ? error.message : error)

        return {
          text: '[Voice message — transcription failed]',
          durationSeconds: 0,
          failed: true,
        }
      }
    },
  }
}
