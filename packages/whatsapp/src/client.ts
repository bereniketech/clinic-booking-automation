import axios, { AxiosInstance } from 'axios'
import crypto from 'crypto'

export interface WhatsAppClient {
  sendText(to: string, text: string): Promise<{ messageId: string }>
  sendTemplate(to: string, template: string, params: string[]): Promise<{ messageId: string }>
  getMediaDownloadUrl(mediaId: string): Promise<string>
  downloadMedia(url: string): Promise<Buffer>
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean
}

export interface WhatsAppClientConfig {
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  appSecret: string
}

export function createWhatsAppClient(config: WhatsAppClientConfig): WhatsAppClient {
  const baseURL = 'https://graph.instagram.com/v18.0'
  const client: AxiosInstance = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  return {
    async sendText(to: string, text: string): Promise<{ messageId: string }> {
      const response = await client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: text },
        }
      )
      return { messageId: response.data.messages[0].id }
    },

    async sendTemplate(
      to: string,
      template: string,
      params: string[]
    ): Promise<{ messageId: string }> {
      const response = await client.post(
        `/${config.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: template,
            language: { code: 'en' },
            parameters: {
              body: {
                parameters: params.map(p => ({ type: 'text', text: p })),
              },
            },
          },
        }
      )
      return { messageId: response.data.messages[0].id }
    },

    async getMediaDownloadUrl(mediaId: string): Promise<string> {
      const response = await client.get(`/${mediaId}`, {
        params: { fields: 'url' },
      })
      return response.data.url
    },

    async downloadMedia(url: string): Promise<Buffer> {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
        responseType: 'arraybuffer',
      })
      return Buffer.from(response.data)
    },

    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
      try {
        const expected = 'sha256=' +
          crypto
            .createHmac('sha256', config.appSecret)
            .update(rawBody)
            .digest('hex')
        return crypto.timingSafeEqual(
          Buffer.from(expected),
          Buffer.from(signature)
        )
      } catch {
        return false
      }
    },
  }
}
