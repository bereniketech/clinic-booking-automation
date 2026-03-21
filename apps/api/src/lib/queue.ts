import { Queue } from 'bullmq'
import Redis from 'redis'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Create the messaging queue for inbound WhatsApp messages
export const messageQueue = new Queue('messaging', {
  connection: {
    url: redisUrl,
  },
})

export interface InboundMessageJob {
  payload: {
    object: string
    entry: Array<{
      id: string
      changes: Array<{
        value: {
          messaging_product: string
          metadata: {
            phone_number_id: string
          }
          messages?: Array<{
            id: string
            from: string
            type: string
            timestamp: string
            text?: { body: string }
            audio?: { id: string; mime_type: string }
          }>
        }
      }>
    }>
  }
}

export async function initializeQueue() {
  try {
    // BullMQ will handle the Redis connection internally
    // eslint-disable-next-line no-console
    console.log('Redis queue ready')
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to connect to Redis:', err)
    throw err
  }
}

export async function closeQueue() {
  await messageQueue.close()
}
