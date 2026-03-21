import { Router, raw } from 'express'
import type { RequestHandler } from 'express'
import { createWhatsAppClient } from '@clinic/whatsapp'
import { messageQueue, type InboundMessageJob } from '../lib/queue.js'

export interface WhatsAppWebhookConfig {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  appSecret: string
  webhookVerifyToken: string
}

export function createWebhooksRouter(config: WhatsAppWebhookConfig): Router {
  const router = Router()
  const whatsappClient = createWhatsAppClient({
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    accessToken: config.accessToken,
    appSecret: config.appSecret,
  })

  // GET /api/v1/webhooks/whatsapp
  // Meta webhook verification challenge
  router.get('/whatsapp', ((req, res) => {
    const mode = req.query['hub.mode'] as string
    const token = req.query['hub.verify_token'] as string
    const challenge = req.query['hub.challenge'] as string

    if (mode === 'subscribe' && token === config.webhookVerifyToken) {
      res.status(200).send(challenge)
    } else {
      res.status(403).end()
    }
  }) as RequestHandler)

  // POST /api/v1/webhooks/whatsapp
  // Inbound message handler with signature verification
  // Uses express.raw() middleware to preserve raw body for HMAC verification
  router.post(
    '/whatsapp',
    raw({ type: 'application/json' }),
    (async (req, res) => {
      const signature = req.headers['x-hub-signature-256'] as string

      if (!signature) {
        return res.status(403).end()
      }

      // Verify webhook signature
      const isValid = whatsappClient.verifyWebhookSignature(req.body, signature)
      if (!isValid) {
        return res.status(403).end()
      }

      // Parse the payload
      let payload: InboundMessageJob['payload']
      try {
        payload = JSON.parse(req.body.toString())
      } catch {
        // Invalid JSON
        return res.status(400).end()
      }

      // Return 200 immediately before any async processing
      res.status(200).end()

      // Enqueue the message processing job asynchronously
      // If enqueue fails, we've already returned 200 so Meta won't retry this webhook
      try {
        await messageQueue.add('InboundMessageJob', { payload } as InboundMessageJob)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to enqueue WhatsApp message:', err)
        // Note: We've already sent 200, so metaretries won't happen
        // In production, this should trigger an alert to the ops team
      }
    }) as RequestHandler
  )

  return router
}
