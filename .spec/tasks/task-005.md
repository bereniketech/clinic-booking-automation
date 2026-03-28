---
task: 005
feature: clinic-booking-automation
status: completed
depends_on: [004]
---

# Task 005: Transcription package & inbound message worker

## Session Bootstrap
> Load these before reading anything else.

Skills: /whatsapp-automation, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Implement `packages/transcription` (OpenAI Whisper, never-throw), the BullMQ worker process in `apps/workers`, and the `InboundMessageJob` processor. Audio messages are downloaded in-memory, transcribed, buffer discarded — never persisted. All messages (text or transcribed voice) flow into `WorkflowExecutionJob`.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// packages/transcription/src/client.ts — interface to implement
export interface TranscriptionResult {
  text: string
  durationSeconds: number
  failed: boolean
}

export interface TranscriptionClient {
  // NEVER throws — returns fallback on any error
  transcribe(audioBuffer: Buffer, mimeType: string): Promise<TranscriptionResult>
}

// Implementation uses openai SDK: openai.audio.transcriptions.create()
// On any error: return { text: '[Voice message — transcription failed]', durationSeconds: 0, failed: true }
// Log the error but do NOT rethrow
```

```typescript
// apps/workers/src/processors/inbound-message.processor.ts — logic to implement
export async function processInboundMessage(job: Job<InboundMessageJobData>) {
  const { payload, clinicId } = job.data
  const message = extractMessage(payload)  // parse Meta webhook payload

  // 1. Resolve clinicId from phone_number_id → clinics table
  // 2. Upsert customer { clinicId, phone: message.from }
  // 3. Upsert conversation { clinicId, customerId, waPhone: message.from }

  let content: string
  let transcribed = false

  if (message.type === 'audio') {
    const downloadUrl = await whatsappClient.getMediaDownloadUrl(message.audio.id)
    const buffer = await whatsappClient.downloadMedia(downloadUrl)
    const result = await transcriptionClient.transcribe(buffer, message.audio.mime_type)
    // buffer goes out of scope here — GC will collect it
    content = result.text
    transcribed = !result.failed
  } else {
    content = message.text?.body ?? ''
  }

  // 4. Save message record
  await db.from('messages').insert({
    clinic_id: clinicId,
    conversation_id: conversation.id,
    direction: 'inbound',
    type: message.type,
    content,
    transcribed,
    wa_message_id: message.id,
    status: 'delivered',
  })

  // 5. Enqueue workflow execution
  await workflowQueue.add('WorkflowExecutionJob', {
    clinicId,
    customerId: customer.id,
    trigger: 'message.received',
    content,
  })
}
```

```typescript
// apps/workers/src/index.ts — worker process entry point
// This runs as a SEPARATE process from apps/api
const messagingWorker = new Worker('messaging', processInboundMessage, {
  connection: redisConnection,
  concurrency: 5,
})

messagingWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, err }, 'InboundMessageJob failed')
})
```

### Key Patterns in Use
- **Never-throw transcription:** Wrap entire Whisper call in try/catch; return fallback object.
- **Buffer lifecycle:** `buffer` is a local variable inside the if-block — it goes out of scope immediately after transcription. Do not assign it to any outer variable or store it anywhere.
- **clinicId from phone_number_id:** The webhook payload contains `metadata.phone_number_id`. Resolve to `clinic_id` via a `whatsapp_numbers` lookup table or `clinics.wa_phone_number_id` column.
- **Separate process:** `apps/workers` has its own entry point and is started with a separate `npm start` — it does NOT import from `apps/api`.

### Architecture Decisions Affecting This Task
- ADR-2: Workers run as separate process — never imported into API
- ADR-5: Audio buffer downloaded in-memory, transcribed, discarded — never written to storage

---

## Handoff from Previous Task
**Files changed by previous task:** task-004 set up the API webhook handler and queue infrastructure. No database migrations were required for this task beyond what was already created.
**Decisions made:** Clinic ID resolution uses existing clinics.whatsapp_phone_number_id column; no separate whatsapp_numbers table needed.
**Context for this task:** Message queue already initialized in API (apps/api/src/lib/queue.ts). Worker process reads from the same Redis queue.
**Open questions left:** None blocking this task.

---

## Implementation Steps
1. Implement `packages/transcription/src/client.ts` — Whisper API via `openai` npm package, never-throw
2. Set up `apps/workers/src/lib/` — Redis connection, DB client, WhatsApp client, Transcription client
3. Implement `apps/workers/src/processors/inbound-message.processor.ts` — full pipeline above
4. Add `whatsapp_numbers` column or table to resolve `phone_number_id` → `clinic_id`
5. Implement `apps/workers/src/index.ts` — BullMQ Worker setup, concurrency 5, error logging
6. Configure retry: `{ attempts: 3, backoff: { type: 'exponential', delay: 2000 } }`
7. Write unit tests: text message saved correctly, audio transcribed + buffer not stored, transcription failure saves fallback, customer upserted on first contact

_Requirements: 5.2, 5.4, 5.5, 8.1_
_Skills: /whatsapp-automation — media download; /code-writing-software-development — worker process, queue patterns_

---

## Acceptance Criteria
- [x] Text message: `content` = raw text, `transcribed` = false, saved to DB
- [x] Audio message: buffer downloaded, Whisper called, buffer not stored anywhere, `content` = transcription, `transcribed` = true
- [x] Whisper failure: `content` = `'[Voice message — transcription failed]'`, `transcribed` = false, message still saved
- [x] Customer upserted on first contact (no duplicate on repeat message)
- [x] `WorkflowExecutionJob` enqueued after every message processed
- [x] Worker runs as standalone process (`apps/workers` has no import from `apps/api`)
- [x] Unit tests written
- [x] TypeScript compiles and ESLint passes

---

## Handoff to Next Task
**Files changed:**
- CREATED: packages/transcription/src/index.ts (OpenAI Whisper integration, never-throw pattern)
- CREATED: apps/workers/src/lib/redis.ts, logger.ts, queue.ts (worker infrastructure)
- CREATED: apps/workers/src/processors/inbound-message.processor.ts (message processing pipeline)
- CREATED: apps/workers/src/processors/inbound-message.processor.test.ts (processor tests)
- CREATED: apps/workers/src/transcription.test.ts (transcription client tests)
- CREATED: apps/workers/jest.config.js (test configuration)
- MODIFIED: apps/workers/src/index.ts (worker entry point with concurrency 5, error handling, graceful shutdown)
- MODIFIED: packages/transcription/package.json (added openai dependency)
- MODIFIED: apps/workers/package.json (added bullmq, redis, pino, jest dependencies)

**Decisions made:**
1. Transcription client: never throws, always returns fallback { text: '[Voice message — transcription failed]', ... failed: true } on error
2. Buffer lifecycle: downloaded in-memory, immediately passed to transcription, goes out of scope after (no persistence)
3. Worker configuration: concurrency 5 for messaging queue, retry with 3 attempts + exponential backoff (2000ms)
4. Clinic ID resolution: queries clinics.whatsapp_phone_number_id directly (no separate table needed)
5. Service role authentication: Supabase client initialized with service role key for RLS enforcement

**Context for next task (Task-006: Workflow Engine):**
- InboundMessageJob successfully enqueues WorkflowExecutionJob with { clinicId, customerId, trigger: 'message.received', content }
- Message record includes: clinic_id, conversation_id, direction, type, content, transcribed flag, wa_message_id, status
- Customer and conversation records are upserted; ready for workflow filtering and matching
- Redis Queue infrastructure (workflow queue) is ready to consume WorkflowExecutionJob
- Worker process runs independently with full access to DB and external services

**Open questions:**
- Workflow engine implementation: ADR needed for trigger/condition/action pattern (predefined rules vs custom?)
