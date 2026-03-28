---
task: 010
feature: clinic-booking-automation
status: completed
depends_on: [003]
---

# Task 010: CRM — customer profiles & timeline

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /postgres-patterns
Commands: /verify, /task-handoff

---

## Objective
Build customer search/filter API and the unified timeline endpoint. Tags must be immediately queryable in workflow conditions. Support optional sub-entities (e.g. pets) via a generic `customer_entities` table.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// GET /api/v1/customers — search + filter
// Query params: q (name/phone), tag, lastAppointmentBefore, lastAppointmentAfter, page, limit
router.get('/', authMiddleware, async (req, res) => {
  const { q, tag, page = 1, limit = 20 } = req.query
  const { clinicId } = req

  let query = db.from('customers')
    .select('*, appointments(starts_at)', { count: 'exact' })
    .eq('clinic_id', clinicId)  // ALWAYS first
    .range((+page - 1) * +limit, +page * +limit - 1)

  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
  }
  if (tag) {
    query = query.contains('tags', [tag])
  }

  const { data, count, error } = await query
  res.json({ customers: data, total: count })
})
```

```typescript
// GET /api/v1/customers/:id/timeline — unified chronological feed
export async function getCustomerTimeline(customerId: string, clinicId: string, db: DbClient) {
  // Fetch all event types in parallel, then merge + sort
  const [messages, appointments, formResponses] = await Promise.all([
    db.from('messages')
      .select('id, type, content, transcribed, direction, created_at')
      .eq('clinic_id', clinicId)
      .eq('conversation_id', /* subquery for conversations.customer_id = customerId */)
      .order('created_at', { ascending: true }),
    db.from('appointments')
      .select('id, service:services(name), starts_at, status, created_at')
      .eq('clinic_id', clinicId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
    db.from('form_responses')
      .select('id, form:forms(name), data, submitted_at')
      .eq('clinic_id', clinicId)
      .eq('customer_id', customerId)
      .order('submitted_at', { ascending: true }),
  ])

  // Tag each event with its type and unify timestamp field
  const events = [
    ...messages.data.map(m => ({ ...m, eventType: 'message', ts: m.created_at })),
    ...appointments.data.map(a => ({ ...a, eventType: 'appointment', ts: a.created_at })),
    ...formResponses.data.map(f => ({ ...f, eventType: 'form_response', ts: f.submitted_at })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

  return events
}
```

```sql
-- customer_entities table for optional sub-entities (e.g. pets)
CREATE TABLE customer_entities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- e.g. 'pet', 'case'
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE customer_entities ENABLE ROW LEVEL SECURITY;
```

### Key Patterns in Use
- **clinic_id always first filter:** Every query starts with `.eq('clinic_id', clinicId)`.
- **Tags as text[]:** Use Supabase `.contains('tags', [tag])` for tag filtering.
- **Timeline: parallel fetches then merge:** Don't JOIN across all tables — fetch in parallel and sort in application code.

### Architecture Decisions Affecting This Task
- Generic `customer_entities` table handles optional sub-entities — no per-clinic-type schema changes needed

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-003)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Add `customer_entities` migration if not already in task-002
2. `GET /api/v1/customers` — search (name/phone), filter (tag, date range), paginated, clinic-scoped
3. `GET /api/v1/customers/:id` — profile with tag list
4. `GET /api/v1/customers/:id/timeline` — parallel fetch + merge + sort
5. `POST /api/v1/customers/:id/tags` and `DELETE /api/v1/customers/:id/tags/:tag` — add/remove tags
6. `GET/POST /api/v1/customers/:id/entities` — optional sub-entity CRUD
7. Write unit tests: search returns only clinic's customers, timeline sorted, tag filter works

_Requirements: 8.1–8.5_
_Skills: /code-writing-software-development — route and service patterns; /postgres-patterns — array contains, parallel queries_

---

## Acceptance Criteria
- [x] Search returns only customers for authenticated clinic
- [x] Tag filter returns customers containing that tag
- [x] Timeline includes messages (with `transcribed` flag), appointments, and form responses in chronological order
- [x] Adding a tag is immediately reflected in search and workflow condition evaluation
- [x] `customer_entities` CRUD works without affecting core customer model
- [x] Unit tests pass
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
