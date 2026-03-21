---
task: 008
feature: clinic-booking-automation
status: pending
depends_on: [005]
---

# Task 008: Workflow engine

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /autonomous-agents-task-automation
Commands: /verify, /task-handoff

---

## Objective
Build the workflow engine: CRUD API for workflows, and the `WorkflowExecutionJob` processor that evaluates trigger→condition→action chains. Every execution is logged. The `trigger_workflow` action must guard against infinite loops.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// Workflow data shape (stored as jsonb in DB)
interface WorkflowCondition {
  field: 'message.content' | 'customer.tag' | 'appointment.service' | 'appointment.status'
  operator: 'eq' | 'neq' | 'contains' | 'not_contains'
  value: string
}

interface WorkflowAction {
  type: 'send_whatsapp' | 'add_tag' | 'assign_staff' | 'trigger_workflow'
  params: {
    // send_whatsapp
    message?: string
    template?: string
    // add_tag
    tag?: string
    // assign_staff
    staffId?: string
    // trigger_workflow
    workflowId?: string
  }
}
```

```typescript
// apps/workers/src/processors/workflow-execution.processor.ts
export async function processWorkflowExecution(
  job: Job<WorkflowExecutionJobData>
) {
  const { clinicId, trigger, context, depth = 0 } = job.data

  // Infinite loop guard
  if (depth > 5) {
    logger.warn({ clinicId, trigger }, 'Workflow max depth exceeded')
    return
  }

  // Load matching active workflows
  const workflows = await db
    .from('workflows')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('trigger_type', trigger)
    .eq('active', true)

  for (const workflow of workflows) {
    const runId = await startWorkflowRun(workflow.id, clinicId, db)
    try {
      // Evaluate conditions
      const conditionsMet = evaluateConditions(workflow.conditions, context)
      if (!conditionsMet) {
        await finishWorkflowRun(runId, 'skipped', {}, db)
        continue
      }
      // Execute actions in order
      for (const action of workflow.actions) {
        await executeAction(action, { clinicId, context, depth }, db)
      }
      await finishWorkflowRun(runId, 'completed', {}, db)
    } catch (err) {
      await finishWorkflowRun(runId, 'failed', { error: err.message }, db)
      throw err  // BullMQ will retry
    }
  }
}

async function executeAction(action: WorkflowAction, meta, db) {
  switch (action.type) {
    case 'send_whatsapp':
      await messagingQueue.add('OutboundMessageJob', {
        clinicId: meta.clinicId,
        to: meta.context.customer.phone,
        type: action.params.template ? 'template' : 'text',
        message: action.params.message,
        template: action.params.template,
      })
      break
    case 'add_tag':
      await addTagToCustomer(meta.context.customerId, action.params.tag, meta.clinicId, db)
      break
    case 'assign_staff':
      await assignConversation(meta.context.conversationId, action.params.staffId, meta.clinicId, db)
      break
    case 'trigger_workflow':
      await workflowQueue.add('WorkflowExecutionJob', {
        clinicId: meta.clinicId,
        trigger: 'workflow.triggered',
        context: meta.context,
        depth: meta.depth + 1,  // increment depth
      })
      break
  }
}
```

### Key Patterns in Use
- **Depth guard:** `depth > 5` stops recursive workflow chains. Depth increments on every `trigger_workflow` action.
- **workflow_runs log:** Every workflow execution (even skipped ones) writes a `workflow_runs` row.
- **Never send WhatsApp directly:** `send_whatsapp` action enqueues `OutboundMessageJob`, never calls WhatsApp client directly.
- **All DB queries use `clinic_id`:** Never load workflows without `eq('clinic_id', clinicId)`.

### Architecture Decisions Affecting This Task
- ADR-2: Workflow engine runs in `apps/workers`, not in API
- Conditions and actions stored as `jsonb` — evaluated at runtime by the processor

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-005)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Workflow CRUD: `GET/POST/PATCH /api/v1/workflows`, `PATCH /api/v1/workflows/:id/toggle`
2. `GET /api/v1/workflows/:id/runs` — paginated execution log
3. Implement `evaluateConditions(conditions, context)` — pure function, fully unit-testable
4. Implement `executeAction` with all four action types
5. Implement `processWorkflowExecution` with depth guard, run logging, retry on throw
6. Add `workflow` BullMQ queue to `apps/workers/src/index.ts`
7. Write unit tests: conditions evaluation (all operators), depth guard stops at 5, failed action retries, run log written for every execution

_Requirements: 6.1–6.6_
_Skills: /code-writing-software-development — processor and condition evaluation; /autonomous-agents-task-automation — event-driven execution patterns_

---

## Acceptance Criteria
- [ ] Workflow only fires for matching `trigger_type` and `clinic_id`
- [ ] All conditions false → workflow skipped, `workflow_runs` logged as `skipped`
- [ ] `trigger_workflow` at depth 6 → silently stopped, no infinite loop
- [ ] Failed action → retried 3× by BullMQ, then `workflow_runs` status = `failed`
- [ ] `workflow_runs` row written for every execution (including skipped)
- [ ] `send_whatsapp` action enqueues `OutboundMessageJob`, never calls WhatsApp directly
- [ ] Unit tests for `evaluateConditions` pass all operator cases
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
