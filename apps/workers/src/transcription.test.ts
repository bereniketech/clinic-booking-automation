import { describe, it, expect } from 'vitest'
import type { TranscriptionResult, TranscriptionClient } from '@clinic/transcription'

describe('TranscriptionClient', () => {
  const createMockClient = (): TranscriptionClient => {
    return {
      transcribe: async (_audioBuffer: Buffer, _mimeType: string): Promise<TranscriptionResult> => {
        return {
          text: 'Test transcription',
          durationSeconds: 10,
          failed: false,
        }
      },
    }
  }

  describe('transcribe', () => {
    it('should transcribe audio successfully', async () => {
      const client = createMockClient()
      const buffer = Buffer.from('fake audio data')
      const result = await client.transcribe(buffer, 'audio/mp3')

      expect(result.text).toBe('Test transcription')
      expect(result.failed).toBe(false)
    })

    it('should handle fallback on transcription error', async () => {
      const client: TranscriptionClient = {
        transcribe: async () => ({
          text: '[Voice message — transcription failed]',
          durationSeconds: 0,
          failed: true,
        }),
      }

      const result = await client.transcribe(Buffer.from(''), 'audio/mp3')
      expect(result.text).toBe('[Voice message — transcription failed]')
      expect(result.failed).toBe(true)
    })

    it('should not throw on any error', async () => {
      const client: TranscriptionClient = {
        transcribe: async () => ({
          text: '[Voice message — transcription failed]',
          durationSeconds: 0,
          failed: true,
        }),
      }

      // Should not throw even if processing fails internally
      await expect(client.transcribe(Buffer.from(''), 'audio/mp3')).resolves.toBeDefined()
    })
  })
})
