---
task: 004
feature: clinic-booking-automation
status: completed
depends_on: [003]
---

# Task 004: WhatsApp webhook ingestion

## Session Bootstrap
> Load these before reading anything else.

Skills: /whatsapp-automation, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Build `packages/whatsapp` (Meta Cloud API client) and the webhook ingestion endpoint. Inbound messages must be signature-verified, enqueued, and acknowledged with 200 within 50ms. No processing happens synchronously.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// packages/whatsapp/src/client.ts — interface to implement
export interface WhatsAppClient {
  sendText(to: string, text: string): Promise<{ messageId: string }>
  sendTemplate(to: string, template: string, params: string[]): Promise<{ messageId: string }>
  getMediaDownloadUrl(mediaId: string): Promise<string>
  downloadMedia(url: string): Promise<Buffer>
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean
}
```

```typescript
// Signature verification — HMAC-SHA256
// X-Hub-Signature-256: sha256=<hex>
import crypto from 'crypto'

function verifyWebhookSignature(rawBody: Buffer, signature: string, appSecret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}
```

```typescript
// apps/api/src/routes/webhooks.ts — pattern
// IMPORTANT: use express.raw() middleware on this route — NOT express.json()
// The raw body is required for HMAC verification

router.post('/webhooks/whatsapp', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-hub-signature-256'] as string
  const valid = whatsappClient.verifyWebhookSignature(req.body, signature)
  if (!valid) return res.status(403).end()

  const payload = JSON.parse(req.body.toString())
  await messageQueue.add('InboundMessageJob', { payload })

  res.status(200).end() // always 200 before any processing
})

// GET for Meta webhook verification challenge
router.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge)
  } else {
    res.status(403).end()
  }
})
```

```typescript
// Inbound payload shape from Meta
interface MetaWebhookPayload {
  object: 'whatsapp_business_account'
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: 'whatsapp'
        metadata: { phone_number_id: string }
        messages?: Array<{
          id: string
          from: string          // customer phone number
          type: 'text' | 'audio' | 'image' | 'document'
          timestamp: string
          text?: { body: string }
          audio?: { id: string; mime_type: string }
        }>
      }
    }>
  }>
}
```

### Key Patterns in Use
- **Raw body for sig verification:** `express.raw()` on webhook route only — all other routes use `express.json()`.
- **Immediate 200:** Return 200 before enqueuing. If enqueue fails, log + return 200 anyway (Meta retries otherwise).
- **Timing-safe comparison:** Use `crypto.timingSafeEqual` — never `===` for signature comparison.

### Architecture Decisions Affecting This Task
- ADR-5: Audio type messages are just enqueued here — transcription happens in the worker (task-005)
- Webhook route has NO auth middleware — sig verification is the only guard

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-003)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Implement `packages/whatsapp/src/client.ts` — all methods of `WhatsAppClient`; use `axios` or `node-fetch` for Meta API calls
2. Implement `verifyWebhookSignature` with `crypto.timingSafeEqual`
3. Set up BullMQ `messaging` queue in `apps/api/src/lib/queue.ts` (Redis connection via `REDIS_URL`)
4. Implement `POST /api/v1/webhooks/whatsapp` — raw body, sig verify, enqueue, 200
5. Implement `GET /api/v1/webhooks/whatsapp` — challenge verification
6. Exempt `/webhooks` routes from `authMiddleware`
7. Write unit tests: invalid sig → 403, valid sig → 200 + job enqueued, challenge GET → returns challenge

_Requirements: 5.1, 5.2, 5.3_
_Skills: /whatsapp-automation — Meta Cloud API patterns; /code-writing-software-development — queue setup_

---

## Acceptance Criteria
- [x] Invalid signature returns 403; message not enqueued
- [x] Valid signature returns 200 within 50ms; job in queue
- [x] Challenge GET returns correct challenge string
- [x] `express.raw()` used on webhook route (raw body preserved for sig check)
- [x] `crypto.timingSafeEqual` used for comparison
- [x] Unit tests pass for all sig verification cases
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:**
- `packages/whatsapp/src/client.ts` — Complete WhatsAppClient implementation with sendText, sendTemplate, getMediaDownloadUrl, downloadMedia, and signature verification
- `packages/whatsapp/src/index.ts` — Exports for public API
- `apps/api/src/lib/queue.ts` — BullMQ messaging queue with InboundMessageJob type
- `apps/api/src/routes/webhooks.ts` — GET and POST handlers for Meta webhook verification and inbound message processing
- `apps/api/src/routes/webhooks.test.ts` — Unit tests verifying signature validation, challenge response, and message enqueuing (9 tests)
- `apps/api/src/index.ts` — Queue initialization and webhook router setup; /webhooks routes exempt from auth

**Decisions made:**
- Used `axios` for Meta API calls (cleaner syntax and error handling than node-fetch)
- Return 200 immediately on POST before async enqueue to satisfy Meta's 50ms timeout expectation
- Error handling: If enqueue fails after 200 response, log error (Meta won't retry; in production should alert ops team)
- Signature verification wraps timingSafeEqual in try-catch to prevent timing attacks on exception paths

**Context for next task:**
- `messageQueue` is ready in BullMQ with Redis connection via REDIS_URL env var
- InboundMessageJob payload type defines the complete Meta webhook structure (text, audio, image, document message types)
- Audio type messages (with mediaId) are enqueued but not processed here; transcription happens in worker (task-005)
- Webhook routes bypass auth middleware; signature verification is the sole guard

**Open questions:**
- None — implementation complete with all tests passing
