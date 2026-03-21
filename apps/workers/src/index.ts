import { Worker } from 'bullmq'
import { createDbClient } from '@clinic/db'
import { createWhatsAppClient } from '@clinic/whatsapp'
import { createTranscriptionClient } from '@clinic/transcription'
import { messagingQueue, workflowQueue } from './lib/queue.js'
import { connectRedis, disconnectRedis } from './lib/redis.js'
import { logger } from './lib/logger.js'
import { processInboundMessage } from './processors/inbound-message.processor.js'

// Load environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_BUSINESS_ACCOUNT_ID',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_APP_SECRET',
  'OPENAI_API_KEY',
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing environment variable: ${envVar}`)
    process.exit(1)
  }
}

async function startWorkers(): Promise<void> {
  try {
    // Connect to Redis
    await connectRedis()
    logger.info('Connected to Redis')

    // Initialize clients
    const db = createDbClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const whatsappClient = createWhatsAppClient({
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
      businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID!,
      accessToken: process.env.WHATSAPP_ACCESS_TOKEN!,
      appSecret: process.env.WHATSAPP_APP_SECRET!,
    })
    const transcriptionClient = createTranscriptionClient(process.env.OPENAI_API_KEY!)

    // Create worker for inbound messages with processor function
    const messagingWorker = new Worker(
      'messaging',
      async (job) => {
        return processInboundMessage(job, {
          db,
          whatsappClient,
          transcriptionClient,
        })
      },
      {
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
        concurrency: 5,
      }
    )

    // Workflow processing placeholder — can be implemented later
    const workflowWorker = new Worker(
      'workflows',
      async () => {
        // Placeholder for workflow execution
        logger.debug('Workflow processing not yet implemented')
      },
      {
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
        concurrency: 2,
      }
    )

    // Error handlers
    messagingWorker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          jobData: job?.data,
          err: err instanceof Error ? err.message : err,
        },
        'InboundMessageJob failed'
      )
    })

    messagingWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'InboundMessageJob completed')
    })

    workflowWorker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          err: err instanceof Error ? err.message : err,
        },
        'WorkflowExecutionJob failed'
      )
    })

    logger.info('Workers started with concurrency 5 (messaging), 2 (workflows)')

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down workers...')
      await messagingWorker.close()
      await workflowWorker.close()
      await messagingQueue.close()
      await workflowQueue.close()
      await disconnectRedis()
      logger.info('Workers shut down gracefully')
      process.exit(0)
    }

    process.on('SIGTERM', gracefulShutdown)
    process.on('SIGINT', gracefulShutdown)
  } catch (err) {
    logger.error(err, 'Failed to start workers')
    process.exit(1)
  }
}

void startWorkers()

