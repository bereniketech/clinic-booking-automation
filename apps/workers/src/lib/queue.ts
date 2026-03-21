import { Queue } from 'bullmq'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// Queue for inbound WhatsApp messages
export const messagingQueue = new Queue('messaging', {
  connection: {
    url: redisUrl,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
})

// Queue for workflow execution
export const workflowQueue = new Queue('workflows', {
  connection: {
    url: redisUrl,
  },
})

export interface InboundMessageJobData {
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

export interface WorkflowExecutionJobData {
  clinicId: string
  customerId: string
  trigger: string
  content: string
}
