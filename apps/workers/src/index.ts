import { Worker } from 'bullmq'
import { createDbClient } from '@clinic/db'
import { createWhatsAppClient } from '@clinic/whatsapp'
import { createTranscriptionClient } from '@clinic/transcription'
import { messagingQueue, workflowQueue, reminderQueue } from './lib/queue.js'
import { connectRedis, disconnectRedis } from './lib/redis.js'
import { logger } from './lib/logger.js'
import { processInboundMessage } from './processors/inbound-message.processor.js'
import { processAppointmentCreated } from './processors/appointment-created.processor.js'
import { processReminder } from './processors/reminder.processor.js'
import { processOutboundMessage } from './processors/outbound-message.processor.js'

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

    // Appointment created worker — schedules reminders
    const appointmentWorker = new Worker(
      'appointments',
      async (job) => {
        return processAppointmentCreated(job, { db, reminderQueue })
      },
      {
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
        concurrency: 2,
      }
    )

    // Reminder worker — fires when delay expires, enqueues outbound message
    const reminderWorker = new Worker(
      'reminders',
      async (job) => {
        return processReminder(job, { db, messagingQueue })
      },
      {
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
        concurrency: 2,
      }
    )

    // Outbound message worker — sends WhatsApp messages
    const outboundWorker = new Worker(
      'outbound',
      async (job) => {
        return processOutboundMessage(job, { db, whatsappClient })
      },
      {
        connection: {
          url: process.env.REDIS_URL || 'redis://localhost:6379',
        },
        concurrency: 3,
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

    appointmentWorker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          err: err instanceof Error ? err.message : err,
        },
        'AppointmentCreatedJob failed'
      )
    })

    appointmentWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'AppointmentCreatedJob completed')
    })

    reminderWorker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          err: err instanceof Error ? err.message : err,
        },
        'ReminderJob failed'
      )
    })

    reminderWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'ReminderJob completed')
    })

    outboundWorker.on('failed', (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          err: err instanceof Error ? err.message : err,
        },
        'OutboundMessageJob failed'
      )
    })

    outboundWorker.on('completed', (job) => {
      logger.info({ jobId: job.id }, 'OutboundMessageJob completed')
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

    logger.info(
      'Workers started: messaging(5), appointments(2), reminders(2), outbound(3), workflows(2)'
    )

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down workers...')
      await messagingWorker.close()
      await appointmentWorker.close()
      await reminderWorker.close()
      await outboundWorker.close()
      await workflowWorker.close()
      await messagingQueue.close()
      await reminderQueue.close()
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

