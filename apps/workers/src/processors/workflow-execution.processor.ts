import { Job } from 'bullmq'
import type { DbClient } from '@clinic/db'
import { Queue } from 'bullmq'
import { logger } from '../lib/logger.js'

export interface WorkflowExecutionJobData {
  clinicId: string
  customerId?: string
  conversationId?: string
  trigger: string
  content?: string
  context?: Record<string, unknown>
  depth?: number
}

interface WorkflowCondition {
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'not_contains'
  value: string
}

interface WorkflowAction {
  type: 'send_whatsapp' | 'add_tag' | 'assign_staff' | 'trigger_workflow'
  params: Record<string, string | undefined>
}

export function evaluateConditions(
  conditions: WorkflowCondition[],
  context: Record<string, unknown>
): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((condition) => {
    const fieldValue = getNestedValue(context, condition.field)
    const strValue = String(fieldValue ?? '')

    switch (condition.operator) {
      case 'eq':
        return strValue === condition.value
      case 'neq':
        return strValue !== condition.value
      case 'contains':
        return strValue.includes(condition.value)
      case 'not_contains':
        return !strValue.includes(condition.value)
      default:
        return false
    }
  })
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

async function startWorkflowRun(
  workflowId: string,
  clinicId: string,
  triggerPayload: unknown,
  db: DbClient
): Promise<string | null> {
  const { data, error } = await db
    .from('workflow_runs')
    .insert({
      clinic_id: clinicId,
      workflow_id: workflowId,
      trigger_payload: triggerPayload as any,
      status: 'running',
    })
    .select('id')
    .single()

  if (error || !data) {
    logger.error({ error, workflowId }, 'Failed to create workflow run')
    return null
  }
  return data.id
}

async function finishWorkflowRun(
  runId: string,
  status: 'completed' | 'failed' | 'skipped',
  metadata: { error?: string },
  db: DbClient
): Promise<void> {
  await db
    .from('workflow_runs')
    .update({
      status,
      error: metadata.error ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq('id', runId)
}

async function executeAction(
  action: WorkflowAction,
  meta: {
    clinicId: string
    context: Record<string, unknown>
    depth: number
  },
  deps: {
    db: DbClient
    messagingQueue: Queue
    workflowQueue: Queue
  }
): Promise<void> {
  const { db, messagingQueue, workflowQueue } = deps

  switch (action.type) {
    case 'send_whatsapp': {
      const phone = meta.context.customerPhone as string | undefined
      if (!phone) {
        logger.warn({ action }, 'send_whatsapp: no customer phone in context')
        return
      }
      await messagingQueue.add('OutboundMessageJob', {
        clinicId: meta.clinicId,
        to: phone,
        type: action.params.template ? 'template' : 'text',
        message: action.params.message,
        template: action.params.template,
      })
      break
    }
    case 'add_tag': {
      const customerId = meta.context.customerId as string | undefined
      if (!customerId || !action.params.tag) return
      // Append tag to customer's tags array
      const { data: customer } = await db
        .from('customers')
        .select('tags')
        .eq('id', customerId)
        .eq('clinic_id', meta.clinicId)
        .single()
      if (customer) {
        const tags = [...((customer as any).tags || []), action.params.tag]
        await db
          .from('customers')
          .update({ tags: [...new Set(tags)] } as any)
          .eq('id', customerId)
          .eq('clinic_id', meta.clinicId)
      }
      break
    }
    case 'assign_staff': {
      const conversationId = meta.context.conversationId as string | undefined
      if (!conversationId || !action.params.staffId) return
      await db
        .from('conversations')
        .update({ assigned_to: action.params.staffId })
        .eq('id', conversationId)
        .eq('clinic_id', meta.clinicId)
      break
    }
    case 'trigger_workflow': {
      await workflowQueue.add('WorkflowExecutionJob', {
        clinicId: meta.clinicId,
        trigger: 'workflow.triggered',
        context: meta.context,
        depth: meta.depth + 1,
      })
      break
    }
  }
}

export async function processWorkflowExecution(
  job: Job<WorkflowExecutionJobData>,
  deps: {
    db: DbClient
    messagingQueue: Queue
    workflowQueue: Queue
  }
): Promise<void> {
  const { clinicId, trigger, depth = 0 } = job.data
  const { db, messagingQueue, workflowQueue } = deps

  // Infinite loop guard
  if (depth > 5) {
    logger.warn({ clinicId, trigger, depth }, 'Workflow max depth exceeded, stopping')
    return
  }

  // Build context from job data
  const context: Record<string, unknown> = {
    ...(job.data.context ?? {}),
    customerId: job.data.customerId,
    conversationId: job.data.conversationId,
    messageContent: job.data.content,
  }

  // If we have a customerId, enrich context with customer data
  if (job.data.customerId) {
    const { data: customer } = await db
      .from('customers')
      .select('phone, name, tags')
      .eq('id', job.data.customerId)
      .eq('clinic_id', clinicId)
      .single()
    if (customer) {
      context.customerPhone = (customer as any).phone
      context.customerName = (customer as any).name
      context.customerTags = (customer as any).tags
    }
  }

  // Load matching active workflows
  const { data: workflows, error } = await db
    .from('workflows')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('trigger', trigger)
    .eq('active', true)

  if (error || !workflows) {
    logger.error({ error, clinicId, trigger }, 'Failed to load workflows')
    return
  }

  for (const workflow of workflows) {
    const conditions = (workflow.conditions ?? []) as unknown as WorkflowCondition[]
    const actions = (workflow.actions ?? []) as unknown as WorkflowAction[]

    const runId = await startWorkflowRun(workflow.id, clinicId, job.data, db)
    if (!runId) continue

    try {
      const conditionsMet = evaluateConditions(conditions, context)
      if (!conditionsMet) {
        await finishWorkflowRun(runId, 'skipped', {}, db)
        continue
      }

      for (const action of actions) {
        await executeAction(action, { clinicId, context, depth }, { db, messagingQueue, workflowQueue })
      }

      await finishWorkflowRun(runId, 'completed', {}, db)
    } catch (err) {
      await finishWorkflowRun(runId, 'failed', { error: (err as Error).message }, db)
      throw err // BullMQ will retry
    }
  }
}
