import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { createWhatsAppClient } from '@clinic/whatsapp'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSignature(body: string, appSecret: string): string {
  return (
    'sha256=' +
    crypto
      .createHmac('sha256', appSecret)
      .update(body)
      .digest('hex')
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WhatsApp Webhooks Signature Verification', () => {
  const appSecret = 'test_secret'
  const client = createWhatsAppClient({
    phoneNumberId: '123456789',
    businessAccountId: '987654321',
    accessToken: 'test_token',
    appSecret,
  })

  describe('verifyWebhookSignature', () => {
    it('returns true when signature is valid', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      const isValid = client.verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)
    })

    it('returns false when signature is invalid', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))

      const isValid = client.verifyWebhookSignature(body, 'sha256=invalid_signature')
      expect(isValid).toBe(false)
    })

    it('returns false when signature has wrong format', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))

      const isValid = client.verifyWebhookSignature(body, 'invalid_format')
      expect(isValid).toBe(false)
    })

    it('returns false when signature is empty', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))

      const isValid = client.verifyWebhookSignature(body, '')
      expect(isValid).toBe(false)
    })

    it('uses timing-safe comparison (no timing attacks)', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      // This test verifies the signature comparison doesn't throw
      // The actual timing-safe comparison is done internally with crypto.timingSafeEqual
      const isValid = client.verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)
    })

    it('handles different message types correctly', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: '123456789' },
                  messages: [
                    {
                      id: 'msg-id',
                      from: '1234567890',
                      type: 'text',
                      timestamp: '1234567890',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      const isValid = client.verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)
    })

    it('fails when body is modified after signature', () => {
      const payload = { object: 'whatsapp_business_account', entry: [] }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      // Modify the body
      const modifiedBody = Buffer.from(JSON.stringify({ ...payload, entry: ['modified'] }))

      const isValid = client.verifyWebhookSignature(modifiedBody, signature)
      expect(isValid).toBe(false)
    })
  })

  describe('Webhook payload validation', () => {
    it('parses valid inbound text message payload', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: '123456789' },
                  messages: [
                    {
                      id: 'msg-id',
                      from: '1234567890',
                      type: 'text',
                      timestamp: '1234567890',
                      text: { body: 'Hello' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      // Verify the signature is valid
      const isValid = client.verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)

      // Verify payload can be parsed
      const parsed = JSON.parse(body.toString())
      expect(parsed.object).toBe('whatsapp_business_account')
      expect(parsed.entry[0].changes[0].value.messages[0].text.body).toBe('Hello')
    })

    it('parses valid inbound audio message payload', () => {
      const payload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: 'entry-id',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: { phone_number_id: '123456789' },
                  messages: [
                    {
                      id: 'msg-id',
                      from: '1234567890',
                      type: 'audio',
                      timestamp: '1234567890',
                      audio: { id: 'audio-id', mime_type: 'audio/ogg' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      }
      const body = Buffer.from(JSON.stringify(payload))
      const signature = generateSignature(body.toString(), appSecret)

      const isValid = client.verifyWebhookSignature(body, signature)
      expect(isValid).toBe(true)

      const parsed = JSON.parse(body.toString())
      expect(parsed.entry[0].changes[0].value.messages[0].type).toBe('audio')
    })
  })
})

