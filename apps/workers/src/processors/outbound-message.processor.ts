import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import type { WhatsAppClient } from '@clinic/whatsapp'
import { logger } from '../lib/logger.js'

export interface OutboundMessageJobData {
  clinicId: string
  to: string
  type: 'text' | 'template'
  message?: string
  template?: string
  params?: string[]
  messageRecordId?: string
}

export async function processOutboundMessage(
  job: Job<OutboundMessageJobData>,
  deps: { db: DbClient; whatsappClient: WhatsAppClient }
): Promise<void> {
  const { clinicId, to, type, message, template, params, messageRecordId } = job.data
  const { db, whatsappClient } = deps

  try {
    let waMessageId: string

    if (type === 'template' && template) {
      const result = await whatsappClient.sendTemplate(to, template, params ?? [])
      waMessageId = result.messageId
    } else if (message) {
      const result = await whatsappClient.sendText(to, message)
      waMessageId = result.messageId
    } else {
      logger.error({ jobId: job.id }, 'OutboundMessageJob missing message or template')
      return
    }

    if (messageRecordId) {
      await db
        .from('messages')
        .update({ status: 'sent', wa_message_id: waMessageId })
        .eq('id', messageRecordId)
        .eq('clinic_id', clinicId)
    }

    logger.info({ jobId: job.id, waMessageId }, 'Outbound message sent')
  } catch (err) {
    const maxAttempts = job.opts.attempts ?? 3
    if (job.attemptsMade >= maxAttempts - 1) {
      if (messageRecordId) {
        await db
          .from('messages')
          .update({ status: 'failed' })
          .eq('id', messageRecordId)
          .eq('clinic_id', clinicId)
      }
      logger.error({ jobId: job.id, err }, 'Outbound message failed after max retries')
    }
    throw err // Let BullMQ retry
  }
}
