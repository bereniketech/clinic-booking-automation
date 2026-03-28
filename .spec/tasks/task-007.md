---
task: 007
feature: clinic-booking-automation
status: completed
depends_on: [006, 005]
---

# Task 007: Notification worker — reminders

## Session Bootstrap
> Load these before reading anything else.

Skills: /whatsapp-automation, /code-writing-software-development
Commands: /verify, /task-handoff

---

## Objective
Implement the `ReminderJob` processor in the workers process. Reminders are delayed BullMQ jobs scheduled when an appointment is created. They must fire exactly once, be cancellable, and respect clinic-configurable timing.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// Scheduling a reminder when appointment is created
// apps/workers/src/processors/appointment-created.processor.ts
export async function onAppointmentCreated(job: Job<AppointmentCreatedEvent>) {
  const { appointmentId, clinicId, startsAt } = job.data

  const clinic = await getClinic(clinicId, db)
  const reminderOffsetHours = clinic.reminder_offset_hours ?? 24

  const reminderAt = new Date(startsAt)
  reminderAt.setHours(reminderAt.getHours() - reminderOffsetHours)
  const delayMs = reminderAt.getTime() - Date.now()

  if (delayMs <= 0) return  // appointment too soon, skip

  const bullJob = await reminderQueue.add(
    'ReminderJob',
    { appointmentId, clinicId },
    { delay: delayMs, jobId: `reminder:${appointmentId}` }  // deterministic jobId
  )

  await db.from('notification_schedules').insert({
    clinic_id: clinicId,
    appointment_id: appointmentId,
    bull_job_id: bullJob.id,
    status: 'scheduled',
    scheduled_for: reminderAt.toISOString(),
  })
}
```

```typescript
// Reminder processor
// apps/workers/src/processors/reminder.processor.ts
export async function processReminder(job: Job<ReminderJobData>) {
  const { appointmentId, clinicId } = job.data

  // Idempotency check
  const schedule = await db
    .from('notification_schedules')
    .select('status')
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
    .single()

  if (!schedule || schedule.status !== 'scheduled') return  // already sent or cancelled

  const appointment = await getAppointment(appointmentId, clinicId, db)
  if (!appointment || appointment.status === 'cancelled') return

  // Enqueue outbound message
  await messagingQueue.add('OutboundMessageJob', {
    clinicId,
    to: appointment.customer.phone,
    type: 'template',
    template: 'appointment_reminder',
    params: [appointment.customer.name, formatDateTime(appointment.startsAt)],
  })

  await db.from('notification_schedules')
    .update({ status: 'sent' })
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
}
```

```typescript
// Cancel flow — called from appointment cancel handler
export async function cancelReminder(appointmentId: string, clinicId: string) {
  const schedule = await db
    .from('notification_schedules')
    .select('bull_job_id, status')
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
    .single()

  if (!schedule || schedule.status !== 'scheduled') return

  const job = await reminderQueue.getJob(schedule.bull_job_id)
  if (job) await job.remove()

  await db.from('notification_schedules')
    .update({ status: 'cancelled' })
    .eq('appointment_id', appointmentId)
    .eq('clinic_id', clinicId)
}
```

### Key Patterns in Use
- **Deterministic jobId:** `jobId: 'reminder:{appointmentId}'` — BullMQ deduplicates by jobId. Prevents double-scheduling if event fires twice.
- **Idempotency via DB status:** Even if the job fires twice, the DB status check prevents double-send.
- **No polling:** Delay is computed once at schedule time using `Date.now()`. BullMQ handles the timer.

### Architecture Decisions Affecting This Task
- Reminders are delayed BullMQ jobs — not cron, not polling
- Cancel removes the BullMQ job via `bull_job_id` stored in `notification_schedules`

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-006)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Add `reminder_offset_hours` column to `clinics` table (migration), default 24
2. Add `WorkflowExecutionJob` / `AppointmentCreatedEvent` processor that schedules reminder on appointment creation
3. Implement `processReminder` processor with idempotency check
4. Implement `cancelReminder` helper called from appointment cancel route
5. Add `notifications` BullMQ queue to `apps/workers/src/index.ts`
6. Write unit tests: reminder scheduled on create, duplicate fire is idempotent, cancel removes job, appointment cancelled skips send

_Requirements: 10.1–10.5_
_Skills: /whatsapp-automation — template message; /code-writing-software-development — delayed jobs, idempotency_

---

## Acceptance Criteria
- [x] Reminder scheduled exactly once per appointment (deterministic jobId deduplicates)
- [x] Reminder fires and sends exactly once (idempotency DB check)
- [x] Cancelling appointment removes BullMQ job and updates `notification_schedules.status = 'cancelled'`
- [x] Appointment with `status = 'cancelled'` at fire time: reminder silently skipped
- [x] `reminder_offset_hours` from clinic config respected
- [x] Unit tests pass
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
