---
task: 011
feature: clinic-booking-automation
status: completed
depends_on: [003, 006]
---

# Task 011: Dynamic forms

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /build-website-web-app
Commands: /verify, /task-handoff

---

## Objective
Build the dynamic forms system: form CRUD API with JSONB schema storage, a public submission endpoint (clinic-scoped by slug), server-side schema validation, and linking form responses to customers. Triggering a form send after appointment creation happens via the workflow engine (`send_form` action).

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// Form schema shape (stored as jsonb in DB)
interface FormField {
  id: string           // UUID or slug used as key in submission data
  label: string
  type: 'text' | 'number' | 'dropdown' | 'date' | 'boolean'
  required: boolean
  options?: string[]   // for dropdown only
}

interface FormSchema {
  fields: FormField[]
}
```

```typescript
// apps/api/src/routes/forms.ts
// POST /api/v1/forms — create form (staff only)
router.post('/', authMiddleware, requireRole('admin', 'staff'), async (req, res) => {
  const { name, schema } = req.body  // Zod validated
  const { clinicId } = req

  // Validate schema shape before storing
  const parsed = FormSchemaZod.safeParse(schema)
  if (!parsed.success) return res.status(422).json({ error: parsed.error })

  const { data, error } = await db.from('forms').insert({
    clinic_id: clinicId,
    name,
    schema,
    slug: slugify(name) + '-' + nanoid(6),
  }).select().single()

  res.status(201).json({ form: data })
})

// GET /api/v1/forms/:slug/submit — public form view (no auth)
router.get('/:slug/submit', async (req, res) => {
  const { slug } = req.params
  const { data: form } = await db.from('forms')
    .select('id, name, schema, clinic_id')
    .eq('slug', slug)
    .single()
  if (!form) return res.status(404).json({ error: { code: 'NOT_FOUND' } })
  res.json({ form })
})
```

```typescript
// POST /api/v1/forms/:slug/submit — public submission
router.post('/:slug/submit', async (req, res) => {
  const { slug } = req.params
  const { customerId, data: submissionData } = req.body

  // Load form
  const { data: form } = await db.from('forms')
    .select('id, schema, clinic_id')
    .eq('slug', slug)
    .single()
  if (!form) return res.status(404).json({ error: { code: 'NOT_FOUND' } })

  // Validate submission against schema
  const errors = validateSubmission(form.schema as FormSchema, submissionData)
  if (errors.length > 0) {
    return res.status(422).json({ error: { code: 'VALIDATION_ERROR', fields: errors } })
  }

  // Save response
  const { data: response } = await db.from('form_responses').insert({
    clinic_id: form.clinic_id,
    form_id: form.id,
    customer_id: customerId ?? null,  // optional — link to customer if known
    data: submissionData,
    submitted_at: new Date().toISOString(),
  }).select().single()

  res.status(201).json({ response })
})
```

```typescript
// Submission validation function
export function validateSubmission(
  schema: FormSchema,
  data: Record<string, unknown>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = []

  for (const field of schema.fields) {
    const value = data[field.id]

    // Required check
    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.id, message: `${field.label} is required` })
      continue
    }

    if (value === undefined || value === null) continue  // optional, not provided — OK

    // Type check
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number') errors.push({ field: field.id, message: `${field.label} must be a number` })
        break
      case 'boolean':
        if (typeof value !== 'boolean') errors.push({ field: field.id, message: `${field.label} must be true or false` })
        break
      case 'dropdown':
        if (!field.options?.includes(value as string)) {
          errors.push({ field: field.id, message: `${field.label} must be one of: ${field.options?.join(', ')}` })
        }
        break
      case 'date':
        if (isNaN(Date.parse(value as string))) {
          errors.push({ field: field.id, message: `${field.label} must be a valid date` })
        }
        break
    }
  }

  return errors
}
```

```sql
-- form_responses table (if not already in task-002 migration)
CREATE TABLE form_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  data         JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
CREATE INDEX form_responses_clinic_id_idx ON form_responses(clinic_id);
CREATE INDEX form_responses_customer_id_idx ON form_responses(customer_id);
```

### Key Patterns in Use
- **Public endpoint uses slug, not ID:** Form submission URL is slug-based so it can be shared externally without exposing internal UUIDs.
- **Schema stored as JSONB:** Form schema is validated at create time and at submission time. The DB stores it as-is.
- **clinic_id carried from form row:** The submission endpoint looks up `clinic_id` from the form — not from an auth header — because it's a public endpoint.
- **Validation errors return 422:** Missing required fields or type mismatches return 422 with a `fields` array, not 400.

### Architecture Decisions Affecting This Task
- Forms are linked to customers via optional `customer_id` — known at submission time if the link comes from an appointment flow, otherwise null for external visitors
- Form send is triggered by the workflow engine (`send_form` action enqueues `OutboundMessageJob` with a form link) — not directly from the forms module

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-003 + task-006)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Add `forms` and `form_responses` migrations if not already in task-002
2. Implement `FormSchemaZod` validator using Zod
3. Implement `slugify` + `nanoid` helper for form slug generation
4. `GET/POST/PATCH /api/v1/forms` — form CRUD (staff/admin only), clinic-scoped
5. `GET /api/v1/forms/:id/responses` — list responses for a form (staff only), paginated
6. `GET /api/v1/forms/:slug/submit` — public view (no auth required)
7. `POST /api/v1/forms/:slug/submit` — public submission with `validateSubmission`
8. Write unit tests: required field missing returns 422, wrong type returns 422, valid submission saved, slug lookup returns 404 for unknown slug

_Requirements: 7.1–7.5_
_Skills: /code-writing-software-development — route patterns, Zod validation; /build-website-web-app — public-facing endpoints_

---

## Acceptance Criteria
- [x] Form schema stored as JSONB and retrievable
- [x] Submission with missing required field returns 422 with field-level errors
- [x] Submission with wrong type (e.g. string for number field) returns 422
- [x] Valid submission saved and linked to `clinic_id` from form row
- [x] `customerId` in submission body links response to customer (optional — null if absent)
- [x] Unknown slug returns 404 (no auth leak)
- [x] All staff-facing endpoints enforce `clinic_id` from JWT
- [x] Unit tests pass
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
