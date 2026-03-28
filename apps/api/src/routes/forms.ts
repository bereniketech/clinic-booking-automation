import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest } from '../middleware/auth.js'

interface FormField {
  id: string
  label: string
  type: 'text' | 'number' | 'dropdown' | 'date' | 'boolean'
  required: boolean
  options?: string[]
}

interface FormSchema {
  fields: FormField[]
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function nanoid(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

export function validateSubmission(
  schema: FormSchema,
  data: Record<string, unknown>
): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = []

  for (const field of schema.fields) {
    const value = data[field.id]

    if (field.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.id, message: `${field.label} is required` })
      continue
    }

    if (value === undefined || value === null) continue

    switch (field.type) {
      case 'number':
        if (typeof value !== 'number') {
          errors.push({ field: field.id, message: `${field.label} must be a number` })
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push({ field: field.id, message: `${field.label} must be true or false` })
        }
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

/**
 * Authenticated forms router — CRUD for forms and listing responses.
 */
export function createFormsRouter(db: SupabaseClient<Database>): Router {
  const router = Router()

  // GET /forms — list forms for clinic
  router.get('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data, error } = await db
      .from('forms')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data ?? [])
  }) as RequestHandler)

  // POST /forms — create form
  router.post('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { name, schema } = req.body as { name?: string; schema?: FormSchema }
    if (!name || !schema || !schema.fields) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and schema are required' } })
      return
    }

    const slug = slugify(name) + '-' + nanoid(6)

    const { data, error } = await db
      .from('forms')
      .insert({
        clinic_id: clinicId,
        name,
        slug,
        schema: schema as any,
        active: true,
      })
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.status(201).json(data)
  }) as RequestHandler)

  // PATCH /forms/:id — update form
  router.patch('/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const updates: Record<string, unknown> = {}
    const { name, schema, active } = req.body
    if (name != null) updates.name = name
    if (schema != null) updates.schema = schema
    if (active != null) updates.active = active

    const { data, error } = await db
      .from('forms')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    if (!data) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }
    res.json(data)
  }) as RequestHandler)

  // GET /forms/:id/responses — list responses
  router.get('/:id/responses', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await db
      .from('form_responses')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .eq('form_id', String(req.params.id))
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json({ responses: data ?? [], total: count })
  }) as RequestHandler)

  return router
}

/**
 * Public forms router — no auth required. Mounted at /api/v1/public/forms.
 * Handles form viewing and submission by slug.
 */
export function createPublicFormsRouter(db: SupabaseClient<Database>): Router {
  const router = Router()

  // GET /public/forms/:slug/submit — public form view (NO AUTH)
  router.get('/:slug/submit', (async (req, res) => {
    const { data: form } = await db
      .from('forms')
      .select('id, name, schema, clinic_id')
      .eq('slug', req.params.slug)
      .single()

    if (!form) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }
    res.json({ form })
  }) as RequestHandler)

  // POST /public/forms/:slug/submit — public submission (NO AUTH)
  router.post('/:slug/submit', (async (req, res) => {
    const { customerId, data: submissionData } = req.body as {
      customerId?: string
      data?: Record<string, unknown>
    }

    if (!submissionData) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'data is required' } })
      return
    }

    const { data: form } = await db
      .from('forms')
      .select('id, schema, clinic_id')
      .eq('slug', req.params.slug)
      .single()

    if (!form) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    const errors = validateSubmission(form.schema as unknown as FormSchema, submissionData)
    if (errors.length > 0) {
      res.status(422).json({ error: { code: 'VALIDATION_ERROR', fields: errors } })
      return
    }

    const { data: response, error } = await db
      .from('form_responses')
      .insert({
        clinic_id: form.clinic_id,
        form_id: form.id,
        customer_id: customerId ?? null,
        responses: submissionData as any,
      })
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.status(201).json({ response })
  }) as RequestHandler)

  return router
}
