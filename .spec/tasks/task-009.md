---
task: 009
feature: clinic-booking-automation
status: completed
depends_on: [005]
---

# Task 009: Messaging worker — outbound

## Session Bootstrap
> Load these before reading anything else.

Skills: /whatsapp-automation, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Implement the `OutboundMessageJob` processor and the staff reply endpoint. All outbound WhatsApp messages route through the worker — never from the API route directly.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/workers/src/processors/outbound-message.processor.ts
export async function processOutboundMessage(job: Job<OutboundMessageJobData>) {
  const { clinicId, to, type, message, template, params, messageRecordId } = job.data

  try {
    let waMessageId: string

    if (type === 'template') {
      const result = await whatsappClient.sendTemplate(to, template, params ?? [])
      waMessageId = result.messageId
    } else {
      const result = await whatsappClient.sendText(to, message)
      waMessageId = result.messageId
    }

    if (messageRecordId) {
      await db.from('messages')
        .update({ status: 'sent', wa_message_id: waMessageId })
        .eq('id', messageRecordId)
        .eq('clinic_id', clinicId)
    }
  } catch (err) {
    // BullMQ will retry — on final failure update status to 'failed'
    if (job.attemptsMade >= (job.opts.attempts ?? 3) - 1) {
      if (messageRecordId) {
        await db.from('messages')
          .update({ status: 'failed' })
          .eq('id', messageRecordId)
          .eq('clinic_id', clinicId)
      }
    }
    throw err
  }
}
```

```typescript
// apps/api/src/routes/conversations.ts — staff reply endpoint
// POST /api/v1/conversations/:id/messages
router.post('/:id/messages', authMiddleware, async (req, res) => {
  const { content } = req.body  // Zod validated
  const { id: conversationId } = req.params
  const { clinicId, userId } = req

  // Verify conversation belongs to this clinic
  const conversation = await getConversation(conversationId, clinicId, db)
  if (!conversation) return res.status(404).json({ error: { code: 'NOT_FOUND' } })

  // Save message record first (optimistic — staff sees it immediately)
  const messageRecord = await db.from('messages').insert({
    clinic_id: clinicId,
    conversation_id: conversationId,
    direction: 'outbound',
    type: 'text',
    content,
    transcribed: false,
    status: 'queued',
  }).select().single()

  // Enqueue outbound job
  await messagingQueue.add('OutboundMessageJob', {
    clinicId,
    to: conversation.wa_phone,
    type: 'text',
    message: content,
    messageRecordId: messageRecord.id,
  }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })

  res.status(201).json({ message: messageRecord })
})
```

### Key Patterns in Use
- **Message record before queue:** Save the message with `status: 'queued'` before enqueuing. Staff see the message immediately in UI; status updates to `sent` or `failed` as worker processes it.
- **messageRecordId in job payload:** Allows worker to update the status of the specific message record.
- **Final attempt detection:** `job.attemptsMade >= attempts - 1` identifies the last retry to update status to `failed`.
- **clinic_id on all DB updates:** Status update always includes `.eq('clinic_id', clinicId)` — never updates by ID alone.

### Architecture Decisions Affecting This Task
- ADR-2: Outbound messages always go through the worker — never sent from API route
- All outbound paths (workflow engine, reminders, staff replies) converge on `OutboundMessageJob`

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-005)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Implement `processOutboundMessage` processor with send + status update + failure handling
2. Add `OutboundMessageJob` to messaging BullMQ worker with retry config
3. Implement `POST /api/v1/conversations/:id/messages` — save record, enqueue, return 201
4. Implement `GET /api/v1/conversations` — inbox list, clinic-scoped, sorted by `last_message_at`
5. Write unit tests: sendText called with correct args, status updated to `sent` on success, status updated to `failed` after max retries, 404 on conversation not in clinic

_Requirements: 5.3, 5.6, 5.7, 9.3_
_Skills: /whatsapp-automation — Meta API send; /code-writing-software-development — optimistic UI pattern, retry handling_

---

## Acceptance Criteria
- [x] Staff reply: message record saved as `queued`, updated to `sent` after worker sends
- [x] After 3 failed Meta API calls: message status = `failed`
- [x] `GET /api/v1/conversations` returns only conversations for authenticated clinic
- [x] `POST /conversations/:id/messages` returns 404 for conversation in different clinic
- [x] All outbound paths (workflow, reminder, staff reply) use `OutboundMessageJob`
- [x] Unit tests pass
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
