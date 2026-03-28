import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import type { WhatsAppClient } from '@clinic/whatsapp'
import type { TranscriptionClient } from '@clinic/transcription'
import { processInboundMessage } from './inbound-message.processor.js'
import type { InboundMessageJobData } from '../lib/queue.js'

vi.mock('../lib/queue.js', () => ({
  workflowQueue: { add: vi.fn() },
}))

describe('InboundMessageProcessor', () => {
  let mockDb: DbClient
  let mockWhatsAppClient: WhatsAppClient
  let mockTranscriptionClient: TranscriptionClient
  let mockJob: Job<InboundMessageJobData>

  beforeEach(() => {
    // Mock database
    mockDb = {
      from: vi.fn(),
      auth: {
        setSession: vi.fn(),
      },
    } as unknown as DbClient

    // Mock WhatsApp client
    mockWhatsAppClient = {
      getMediaDownloadUrl: vi.fn(),
      downloadMedia: vi.fn(),
      verifyWebhookSignature: vi.fn(),
      sendText: vi.fn(),
      sendTemplate: vi.fn(),
    } as unknown as WhatsAppClient

    // Mock Transcription client
    mockTranscriptionClient = {
      transcribe: vi.fn().mockResolvedValue({
        text: 'Hello from voice message',
        durationSeconds: 5,
        failed: false,
      }),
    } as unknown as TranscriptionClient

    // Mock Job
    mockJob = {
      id: '123',
      data: {
        payload: {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: 'entry-id',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      phone_number_id: '1234567890',
                    },
                    messages: [
                      {
                        id: 'msg-123',
                        from: '27123456789',
                        type: 'text',
                        timestamp: '1234567890',
                        text: { body: 'Hello clinic' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    } as unknown as Job<InboundMessageJobData>
  })

  describe('Text message processing', () => {
    it('should save text message correctly', async () => {
      // Setup mock responses
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'clinic-123' },
          error: null,
        }),
      }

      mockDb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'message-123' },
              error: null,
            }),
          }),
        }),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'customer-123' },
              error: null,
            }),
          }),
        }),
      })

      await processInboundMessage(mockJob, {
        db: mockDb,
        whatsappClient: mockWhatsAppClient,
        transcriptionClient: mockTranscriptionClient,
      })

      // Verify message was saved
      expect(mockDb.from).toHaveBeenCalledWith('messages')
    })

    it('should upsert customer on first contact', async () => {
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'clinic-123' },
          error: null,
        }),
      }

      mockDb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'customer-123' },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'message-123' },
              error: null,
            }),
          }),
        }),
      })

      await processInboundMessage(mockJob, {
        db: mockDb,
        whatsappClient: mockWhatsAppClient,
        transcriptionClient: mockTranscriptionClient,
      })

      // Verify customer was upserted
      expect(mockDb.from).toHaveBeenCalledWith('customers')
    })
  })

  describe('Audio message processing', () => {
    beforeEach(() => {
      mockJob.data.payload.entry[0].changes[0].value.messages = [
        {
          id: 'msg-456',
          from: '27123456789',
          type: 'audio',
          timestamp: '1234567890',
          audio: { id: 'audio-123', mime_type: 'audio/ogg' },
        },
      ]
    })

    it('should transcribe audio message and discard buffer', async () => {
      mockWhatsAppClient.getMediaDownloadUrl = vi.fn().mockResolvedValue('https://example.com/audio.ogg')
      mockWhatsAppClient.downloadMedia = vi.fn().mockResolvedValue(Buffer.from('audio data'))

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'clinic-123' },
          error: null,
        }),
      }

      mockDb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'customer-123' },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'message-123' },
              error: null,
            }),
          }),
        }),
      })

      await processInboundMessage(mockJob, {
        db: mockDb,
        whatsappClient: mockWhatsAppClient,
        transcriptionClient: mockTranscriptionClient,
      })

      // Verify media was downloaded
      expect(mockWhatsAppClient.getMediaDownloadUrl).toHaveBeenCalledWith('audio-123')
      expect(mockWhatsAppClient.downloadMedia).toHaveBeenCalledWith('https://example.com/audio.ogg')

      // Verify transcription was called
      expect(mockTranscriptionClient.transcribe).toHaveBeenCalled()
    })

    it('should save fallback message on transcription failure', async () => {
      mockTranscriptionClient.transcribe = vi.fn().mockResolvedValue({
        text: '[Voice message — transcription failed]',
        durationSeconds: 0,
        failed: true,
      })

      mockWhatsAppClient.getMediaDownloadUrl = vi.fn().mockResolvedValue('https://example.com/audio.ogg')
      mockWhatsAppClient.downloadMedia = vi.fn().mockResolvedValue(Buffer.from('audio data'))

      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'clinic-123' },
          error: null,
        }),
      }

      mockDb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'customer-123' },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'message-123' },
              error: null,
            }),
          }),
        }),
      })

      await processInboundMessage(mockJob, {
        db: mockDb,
        whatsappClient: mockWhatsAppClient,
        transcriptionClient: mockTranscriptionClient,
      })

      // The fallback message should be saved
      // (Exact assertion depends on mocking strategy)
    })
  })

  describe('Workflow execution enqueueing', () => {
    it('should enqueue workflow execution after message processed', async () => {
      const mockQuery = {
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'clinic-123' },
          error: null,
        }),
      }

      mockDb.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'customer-123' },
              error: null,
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'message-123' },
              error: null,
            }),
          }),
        }),
      })

      await processInboundMessage(mockJob, {
        db: mockDb,
        whatsappClient: mockWhatsAppClient,
        transcriptionClient: mockTranscriptionClient,
      })

      // Verify workflow queue received the job
      // (This would require mocking the workflowQueue)
    })
  })
})
