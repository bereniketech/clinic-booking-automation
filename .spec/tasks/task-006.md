---
task: 006
feature: clinic-booking-automation
status: pending
depends_on: [003]
---

# Task 006: Scheduling engine — slot generation & booking

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /postgres-patterns
Commands: /verify, /task-handoff

---

## Objective
Build the scheduling engine: service/staff CRUD, working hours, slot generation algorithm, and atomic booking with advisory lock. Reschedule and cancel must be atomic slot swaps. All operations enforce `clinic_id`.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// Slot generation algorithm
export async function getAvailableSlots(params: {
  clinicId: string
  serviceId: string
  staffId: string
  date: string  // YYYY-MM-DD
}, db: DbClient): Promise<Slot[]> {
  const service = await getService(params.serviceId, params.clinicId, db)
  const workingHours = await getWorkingHours(params.staffId, params.clinicId, params.date, db)
  if (!workingHours) return []

  const existingAppointments = await getAppointmentsForStaff(
    params.staffId, params.clinicId, params.date, db
  )
  const blocks = await getBlocks(params.clinicId, params.date, db)

  const slotDuration = service.duration_minutes + service.buffer_minutes
  const slots: Slot[] = []
  let cursor = workingHours.start  // minutes from midnight

  while (cursor + service.duration_minutes <= workingHours.end) {
    const slotEnd = cursor + slotDuration
    const conflict = existingAppointments.some(a =>
      a.startMinutes < slotEnd && a.endMinutes > cursor
    )
    const blocked = blocks.some(b => b.startMinutes < slotEnd && b.endMinutes > cursor)

    if (!conflict && !blocked) {
      slots.push({ startsAt: minutesToTime(params.date, cursor) })
    }
    cursor += slotDuration
  }
  return slots
}
```

```typescript
// Atomic booking with advisory lock
export async function createAppointment(params: CreateAppointmentParams, db: DbClient) {
  return db.rpc('create_appointment_with_lock', {
    p_clinic_id: params.clinicId,
    p_customer_id: params.customerId,
    p_service_id: params.serviceId,
    p_staff_id: params.staffId,
    p_starts_at: params.startsAt,
    p_ends_at: params.endsAt,
  })
  // The Postgres function uses pg_advisory_xact_lock before inserting
  // Returns the appointment or raises a conflict exception
}
```

```sql
-- Postgres function for atomic booking
CREATE OR REPLACE FUNCTION create_appointment_with_lock(
  p_clinic_id uuid, p_customer_id uuid, p_service_id uuid,
  p_staff_id uuid, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS appointments AS $$
DECLARE
  v_appointment appointments;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::text || p_starts_at::text));

  -- Check for conflicts
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE staff_id = p_staff_id
      AND clinic_id = p_clinic_id
      AND status != 'cancelled'
      AND starts_at < p_ends_at AND ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'SLOT_CONFLICT';
  END IF;

  INSERT INTO appointments (clinic_id, customer_id, service_id, staff_id, starts_at, ends_at, status)
  VALUES (p_clinic_id, p_customer_id, p_service_id, p_staff_id, p_starts_at, p_ends_at, 'scheduled')
  RETURNING * INTO v_appointment;

  RETURN v_appointment;
END;
$$ LANGUAGE plpgsql;
```

### Key Patterns in Use
- **Advisory lock in Postgres function:** Lock is acquired and released within the transaction — never in application code.
- **clinic_id on every query:** `getService`, `getWorkingHours`, `getAppointmentsForStaff` all receive and enforce `clinicId`.
- **Cancel removes reminder:** On cancel, look up `notification_schedules` by `appointment_id` and call `reminderQueue.remove(bull_job_id)`.

### Architecture Decisions Affecting This Task
- Slot generation is pure computation — no DB write; only reads
- Booking uses a Postgres function to keep lock + insert atomic

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-003)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Service CRUD: `GET/POST/PATCH /api/v1/services`, `POST /api/v1/services/:id/staff` (assign staff)
2. Working hours CRUD: `GET/PUT /api/v1/staff/:id/working-hours`
3. Blocks/holidays: `GET/POST/DELETE /api/v1/clinics/blocks`
4. Add `create_appointment_with_lock` Postgres function as a migration
5. Slot generation service: `getAvailableSlots` — algorithm as above
6. `GET /api/v1/slots?serviceId=&staffId=&date=` — returns available slots
7. `POST /api/v1/appointments` — call `create_appointment_with_lock`, emit `AppointmentCreatedEvent` to queue, return 201
8. `PATCH /api/v1/appointments/:id` — reschedule (lock + swap) or cancel (release + remove reminder jobs)
9. Write unit tests: slot generation excludes conflicts and blocks, concurrent booking → one 409

_Requirements: 3.1–3.5, 4.1–4.6_
_Skills: /code-writing-software-development — service and route patterns; /postgres-patterns — advisory lock, atomic operations_

---

## Acceptance Criteria
- [ ] Concurrent booking of same slot: exactly one succeeds, other gets 409
- [ ] Slots outside working hours not returned
- [ ] Slots on holidays/blocks not returned
- [ ] Service with no assigned staff not bookable (no slots returned)
- [ ] Cancel removes BullMQ reminder job via `notification_schedules.bull_job_id`
- [ ] All endpoints enforce `clinic_id` from JWT
- [ ] Unit tests pass
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
