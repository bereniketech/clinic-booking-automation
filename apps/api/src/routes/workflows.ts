import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest } from '../middleware/auth.js'

export function createWorkflowsRouter(db: SupabaseClient<Database>): Router {
  const router = Router()

  // GET /workflows
  router.get('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data, error } = await db
      .from('workflows')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data ?? [])
  }) as RequestHandler)

  // POST /workflows
  router.post('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { name, trigger, conditions, actions } = req.body
    if (!name || !trigger) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'name and trigger are required' } })
      return
    }

    const { data, error } = await db
      .from('workflows')
      .insert({
        clinic_id: clinicId,
        name,
        trigger,
        conditions: conditions ?? [],
        actions: actions ?? [],
        active: true,
      })
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.status(201).json(data)
  }) as RequestHandler)

  // PATCH /workflows/:id
  router.patch('/:id', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const updates: Record<string, unknown> = {}
    const { name, trigger, conditions, actions } = req.body
    if (name != null) updates.name = name
    if (trigger != null) updates.trigger = trigger
    if (conditions != null) updates.conditions = conditions
    if (actions != null) updates.actions = actions

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: { code: 'NO_UPDATES' } })
      return
    }

    const { data, error } = await db
      .from('workflows')
      .update(updates)
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    if (!data) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }
    res.json(data)
  }) as RequestHandler)

  // PATCH /workflows/:id/toggle
  router.patch('/:id/toggle', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    // Get current state
    const { data: current } = await db
      .from('workflows')
      .select('active')
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .single()

    if (!current) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    const { data, error } = await db
      .from('workflows')
      .update({ active: !current.active })
      .eq('clinic_id', clinicId)
      .eq('id', String(req.params.id))
      .select('*')
      .single()

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data)
  }) as RequestHandler)

  // GET /workflows/:id/runs
  router.get('/:id/runs', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data, error, count } = await db
      .from('workflow_runs')
      .select('*', { count: 'exact' })
      .eq('clinic_id', clinicId)
      .eq('workflow_id', String(req.params.id))
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json({ runs: data ?? [], total: count })
  }) as RequestHandler)

  return router
}
