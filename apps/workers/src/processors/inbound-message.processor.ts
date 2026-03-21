import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import type { WhatsAppClient } from '@clinic/whatsapp'
import type { TranscriptionClient } from '@clinic/transcription'
import { workflowQueue, type InboundMessageJobData } from '../lib/queue.js'
import { logger } from '../lib/logger.js'

/**
 * Parse the Meta webhook payload to extract a single message.
 * Assumes exactly one message in the payload.
 */
function extractMessage(
  payload: InboundMessageJobData['payload']
): {
  id: string
  from: string
  type: 'text' | 'audio'
  text?: { body: string }
  audio?: { id: string; mime_type: string }
} | null {
  try {
    const entry = payload.entry?.[0]
    if (!entry) return null

    const change = entry.changes?.[0]
    if (!change) return null

    const messages = change.value.messages
    if (!messages || messages.length === 0) return null

    const message = messages[0]
    // Validate type is one of the allowed values
    if (message.type !== 'text' && message.type !== 'audio') {
      return null
    }

    return {
      id: message.id,
      from: message.from,
      type: message.type,
      text: message.text,
      audio: message.audio,
    }
  } catch (err) {
    logger.error({ err }, 'Failed to extract message from payload')
    return null
  }
}

/**
 * Resolve clinic ID from phone_number_id via clinics.whatsapp_phone_number_id
 */
async function resolveClinicId(
  db: DbClient,
  phoneNumberId: string
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('clinics')
      .select('id')
      .eq('whatsapp_phone_number_id', phoneNumberId)
      .single()

    if (error || !data) {
      logger.warn({ phoneNumberId }, 'Clinic not found for phone_number_id')
      return null
    }

    return data.id
  } catch (err) {
    logger.error({ err, phoneNumberId }, 'Error resolving clinic ID')
    return null
  }
}

/**
 * Upsert customer by clinic_id and phone number
 */
async function upsertCustomer(
  db: DbClient,
  clinicId: string,
  phone: string
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('customers')
      .upsert(
        {
          clinic_id: clinicId,
          phone,
        },
        {
          onConflict: 'clinic_id,phone',
        }
      )
      .select('id')
      .single()

    if (error || !data) {
      logger.error({ err: error, clinicId, phone }, 'Failed to upsert customer')
      return null
    }

    return data.id
  } catch (err) {
    logger.error({ err, clinicId, phone }, 'Error upserting customer')
    return null
  }
}

/**
 * Upsert conversation by clinic_id and customer_id
 */
async function upsertConversation(
  db: DbClient,
  clinicId: string,
  customerId: string
): Promise<string | null> {
  try {
    const { data, error } = await db
      .from('conversations')
      .upsert(
        {
          clinic_id: clinicId,
          customer_id: customerId,
        },
        {
          onConflict: 'clinic_id,customer_id',
        }
      )
      .select('id')
      .single()

    if (error || !data) {
      logger.error({ err: error, clinicId, customerId }, 'Failed to upsert conversation')
      return null
    }

    return data.id
  } catch (err) {
    logger.error({ err, clinicId, customerId }, 'Error upserting conversation')
    return null
  }
}

/**
 * Save message record to database
 */
async function saveMessage(
  db: DbClient,
  data: {
    clinicId: string
    conversationId: string
    type: 'text' | 'audio'
    content: string
    transcribed: boolean
    waMessageId?: string
  }
): Promise<string | null> {
  try {
    const { data: result, error } = await db
      .from('messages')
      .insert({
        clinic_id: data.clinicId,
        conversation_id: data.conversationId,
        direction: 'inbound',
        type: data.type,
        content: data.content,
        transcribed: data.transcribed,
        wa_message_id: data.waMessageId || null,
        status: 'delivered',
      })
      .select('id')
      .single()

    if (error || !result) {
      logger.error({ err: error, ...data }, 'Failed to save message')
      return null
    }

    return result.id
  } catch (err) {
    logger.error({ err, ...data }, 'Error saving message')
    return null
  }
}

export async function processInboundMessage(
  job: Job<InboundMessageJobData>,
  deps: {
    db: DbClient
    whatsappClient: WhatsAppClient
    transcriptionClient: TranscriptionClient
  }
): Promise<void> {
  const { payload } = job.data
  const { db, whatsappClient, transcriptionClient } = deps

  logger.info({ jobId: job.id }, 'Processing inbound message')

  // Extract message from payload
  const message = extractMessage(payload)
  if (!message) {
    logger.warn({ jobId: job.id }, 'No message found in payload')
    return
  }

  // Extract phone_number_id from metadata
  const phoneNumberId = payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id
  if (!phoneNumberId) {
    logger.warn({ jobId: job.id }, 'No phone_number_id in payload')
    return
  }

  // Resolve clinic ID
  const clinicId = await resolveClinicId(db, phoneNumberId)
  if (!clinicId) {
    logger.error({ phoneNumberId }, 'Failed to resolve clinic ID')
    return
  }

  // Note: Using service role key directly, no session needed for RLS enforcement
  // The Supabase client is initialized with service role credentials

  // Upsert customer
  const customerId = await upsertCustomer(db, clinicId, message.from)
  if (!customerId) {
    logger.error({ clinicId, phone: message.from }, 'Failed to upsert customer')
    return
  }

  // Upsert conversation
  const conversationId = await upsertConversation(db, clinicId, customerId)
  if (!conversationId) {
    logger.error({ clinicId, customerId }, 'Failed to upsert conversation')
    return
  }

  // Handle message content
  let content: string
  let transcribed = false

  if (message.type === 'audio' && message.audio) {
    try {
      const downloadUrl = await whatsappClient.getMediaDownloadUrl(message.audio.id)
      const buffer = await whatsappClient.downloadMedia(downloadUrl)

      const result = await transcriptionClient.transcribe(buffer, message.audio.mime_type)
      content = result.text
      transcribed = !result.failed

      // buffer goes out of scope here — GC will collect it
    } catch (err) {
      logger.error({ err, jobId: job.id }, 'Error processing audio message')
      content = '[Voice message — transcription failed]'
      transcribed = false
    }
  } else if (message.type === 'text' && message.text) {
    content = message.text.body
  } else {
    content = ''
  }

  // Save message
  const messageId = await saveMessage(db, {
    clinicId,
    conversationId,
    type: message.type,
    content,
    transcribed,
    waMessageId: message.id,
  })

  if (!messageId) {
    logger.error({ jobId: job.id }, 'Failed to save message')
    return
  }

  logger.info({ jobId: job.id, messageId }, 'Message saved successfully')

  // Enqueue workflow execution
  try {
    await workflowQueue.add('WorkflowExecutionJob', {
      clinicId,
      customerId,
      trigger: 'message.received',
      content,
    })
    logger.info({ jobId: job.id }, 'Workflow execution enqueued')
  } catch (err) {
    logger.error({ err, jobId: job.id }, 'Failed to enqueue workflow execution')
  }
}
