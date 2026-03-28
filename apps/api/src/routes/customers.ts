import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest } from '../middleware/auth.js'

export function createCustomersRouter(db: SupabaseClient<Database>): Router {
  const router = Router()

  // GET /customers — search + filter
  router.get('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { q, tag, page = '1', limit = '20' } = req.query as Record<string, string>
    const pageNum = parseInt(page) || 1
    const limitNum = parseInt(limit) || 20
    const from = (pageNum - 1) * limitNum
    const to = from + limitNum - 1

    let query = db
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)

    if (q) {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    }
    if (tag) {
      query = query.contains('tags', [tag])
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json({ customers: data ?? [], total: count })
  }) as RequestHandler)

  // GET /customers/:id
  router.get('/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data, error } = await db
      .from('customers')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .single()

    if (error || !data) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }
    res.json(data)
  }) as RequestHandler)

  // GET /customers/:id/timeline
  router.get('/:id/timeline', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }
    const customerId = String(req.params.id)

    // Get conversations for this customer to fetch messages
    const { data: conversations } = await db
      .from('conversations')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('customer_id', customerId)

    const conversationIds = (conversations ?? []).map(c => c.id)

    // Fetch messages, appointments, form_responses in parallel
    const [messagesResult, appointmentsResult, formResponsesResult] = await Promise.all([
      conversationIds.length > 0
        ? db
            .from('messages')
            .select('id, type, content, transcribed, direction, created_at')
            .eq('clinic_id', clinicId)
            .in('conversation_id', conversationIds)
            .order('created_at', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      db
        .from('appointments')
        .select('id, service_id, starts_at, status, created_at')
        .eq('clinic_id', clinicId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true }),
      db
        .from('form_responses')
        .select('id, form_id, responses, created_at')
        .eq('clinic_id', clinicId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: true }),
    ])

    const events = [
      ...(messagesResult.data ?? []).map(m => ({ ...m, eventType: 'message', ts: m.created_at })),
      ...(appointmentsResult.data ?? []).map(a => ({ ...a, eventType: 'appointment', ts: a.created_at })),
      ...(formResponsesResult.data ?? []).map(f => ({ ...f, eventType: 'form_response', ts: f.created_at })),
    ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    res.json(events)
  }) as RequestHandler)

  // POST /customers/:id/tags
  router.post('/:id/tags', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { tag } = req.body as { tag?: string }
    if (!tag) { res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'tag is required' } }); return }

    const { data: customer } = await db
      .from('customers')
      .select('tags')
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .single()

    if (!customer) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    const tags = [...new Set([...(customer.tags || []), tag])]
    const { data, error } = await db
      .from('customers')
      .update({ tags })
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data)
  }) as RequestHandler)

  // DELETE /customers/:id/tags/:tag
  router.delete('/:id/tags/:tag', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data: customer } = await db
      .from('customers')
      .select('tags')
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .single()

    if (!customer) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    const tags = (customer.tags || []).filter(t => t !== String(req.params.tag))
    const { data, error } = await db
      .from('customers')
      .update({ tags })
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data)
  }) as RequestHandler)

  // GET /customers/:id/entities
  router.get('/:id/entities', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data, error } = await db
      .from('customer_entities')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('customer_id', String(req.params.id))
      .order('created_at', { ascending: false })

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data ?? [])
  }) as RequestHandler)

  // POST /customers/:id/entities
  router.post('/:id/entities', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { entityType, data: entityData } = req.body as { entityType?: string; data?: Record<string, unknown> }
    if (!entityType) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'entityType is required' } })
      return
    }

    const { data, error } = await db
      .from('customer_entities')
      .insert({
        clinic_id: clinicId,
        customer_id: String(req.params.id),
        entity_type: entityType,
        data: entityData ?? {},
      } as any)
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.status(201).json(data)
  }) as RequestHandler)

  return router
}
