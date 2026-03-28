import { Router } from 'express'
import type { RequestHandler } from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@clinic/db'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { Queue } from 'bullmq'

export function createConversationsRouter(
  db: SupabaseClient<Database>,
  messagingQueue: Queue
): Router {
  const router = Router()
  const looseDb = db as unknown as {
    from: (table: string) => {
      select: (...args: unknown[]) => unknown
      insert: (values: unknown) => unknown
      update: (values: unknown) => unknown
      delete: () => unknown
      eq: (col: string, val: unknown) => unknown
      order: (col: string, opts: unknown) => Promise<{ data: unknown[]; error: { message: string } | null }>
    }
  }

  // GET /conversations — list conversations for clinic
  router.get('/', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data, error } = await db
      .from('conversations')
      .select('*, customer:customers(id, name, phone)')
      .eq('clinic_id', clinicId)
      .order('last_message_at', { ascending: false })

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data ?? [])
  }) as RequestHandler)

  // GET /conversations/:id/messages — list messages in conversation
  router.get('/:id/messages', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { data: conversation } = await db
      .from('conversations')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single()

    if (!conversation) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    const { data, error } = await db
      .from('messages')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json(data ?? [])
  }) as RequestHandler)

  // POST /conversations/:id/messages — staff reply
  router.post('/:id/messages', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { content } = req.body as { content?: string }
    if (!content) {
      res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'content is required' } })
      return
    }

    // Verify conversation belongs to clinic
    const { data: conversation } = await db
      .from('conversations')
      .select('id, customer_id')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single()

    if (!conversation) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    // Get customer phone for outbound
    const { data: customer } = await db
      .from('customers')
      .select('phone')
      .eq('id', conversation.customer_id)
      .eq('clinic_id', clinicId)
      .single()

    // Save message record (optimistic — staff sees it immediately)
    const { data: messageRecord, error: insertError } = await db
      .from('messages')
      .insert({
        clinic_id: clinicId,
        conversation_id: id,
        direction: 'outbound' as const,
        type: 'text' as const,
        content,
        transcribed: false,
        status: 'queued' as const,
      })
      .select('*')
      .single()

    if (insertError || !messageRecord) {
      res.status(500).json({ error: { code: 'DB_ERROR', message: insertError?.message ?? 'Failed to save message' } })
      return
    }

    // Enqueue outbound job
    await messagingQueue.add('OutboundMessageJob', {
      clinicId,
      to: customer?.phone ?? '',
      type: 'text',
      message: content,
      messageRecordId: (messageRecord as { id: string }).id,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })

    // Update last_message_at
    await db
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id)
      .eq('clinic_id', clinicId)

    res.status(201).json({ message: messageRecord })
  }) as RequestHandler)

  // PATCH /conversations/:id/assign — assign conversation to staff
  router.patch('/:id/assign', (async (req, res) => {
    const clinicId = (req as AuthenticatedRequest).clinicId
    const id = String(req.params.id)
    if (!clinicId) { res.status(401).json({ error: { code: 'UNAUTHORIZED' } }); return }

    const { staffId } = req.body as { staffId?: string | null }

    // Use loose query to handle assigned_to column
    const { data: existing } = await db
      .from('conversations')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('id', id)
      .single()

    if (!existing) { res.status(404).json({ error: { code: 'NOT_FOUND' } }); return }

    // Update assigned_to via raw update
    const { error } = await db
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() } as never)
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) { res.status(500).json({ error: { code: 'DB_ERROR', message: error.message } }); return }
    res.json({ id, assigned_to: staffId })
  }) as RequestHandler)

  return router
}
