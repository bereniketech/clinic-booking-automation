---
task: 001
feature: clinic-booking-automation
status: pending
depends_on: []
---

# Task 001: Monorepo scaffold & shared infrastructure

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /build-website-web-app
Commands: /verify, /task-handoff

---

## Objective
Create the npm workspaces monorepo structure with all apps and packages scaffolded, TypeScript/ESLint/Prettier configured, and `packages/shared` populated with all core interfaces and types from the design.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// Shared types to implement in packages/shared/src/index.ts

type PlanTier = 'starter' | 'growth' | 'enterprise'
type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
type TriggerType = 'appointment.created' | 'appointment.completed' | 'no_response' | 'time_based'

interface Clinic { id: string; name: string; plan: PlanTier; status: 'active' | 'suspended'; createdAt: Date }
interface User   { id: string; clinicId: string; email: string; role: 'admin' | 'provider' | 'receptionist'; active: boolean }
interface Customer { id: string; clinicId: string; phone: string; name?: string; tags: string[]; createdAt: Date }
interface Appointment { id: string; clinicId: string; customerId: string; serviceId: string; staffId: string; startsAt: Date; endsAt: Date; status: AppointmentStatus }
interface Message { id: string; clinicId: string; conversationId: string; direction: 'inbound' | 'outbound'; type: 'text' | 'audio'; content: string; transcribed: boolean; waMessageId: string; status: MessageStatus; createdAt: Date }
interface Workflow { id: string; clinicId: string; trigger: TriggerType; conditions: Condition[]; actions: Action[]; active: boolean }
interface Condition { field: string; operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'; value: unknown }
interface Action { type: 'send_whatsapp' | 'add_tag' | 'assign_staff' | 'trigger_workflow'; params: Record<string, unknown> }
```

### Key Patterns in Use
- **Explicit clinicId:** Every service function receives `clinicId` as an explicit parameter — never from context or globals.
- **No circular deps:** `packages/shared` has zero dependencies on other local packages.
- **Workspace naming:** Package names follow `@clinic/<name>` convention (e.g. `@clinic/shared`).

### Architecture Decisions Affecting This Task
- ADR-1: npm workspaces monorepo — `apps/api`, `apps/workers`, `apps/dashboard`, `packages/shared`, `packages/db`, `packages/whatsapp`, `packages/transcription`
- ADR-2: `apps/workers` is a standalone process — its `package.json` must NOT import from `apps/api`

---

## Handoff from Previous Task
**Files changed by previous task:** _(none — this is task 001)_
**Decisions made:** _(none yet)_
**Context for this task:** _(none yet)_
**Open questions left:** _(none yet)_

---

## Implementation Steps
1. Create root `package.json` with `"workspaces": ["apps/*", "packages/*"]`, scripts: `build`, `lint`, `test`
2. Create `packages/shared/` — `package.json` (`@clinic/shared`), `tsconfig.json`, `src/index.ts` with all interfaces above
3. Create `packages/db/` — stub `package.json` (`@clinic/db`), depends on `@clinic/shared`
4. Create `packages/whatsapp/` — stub `package.json` (`@clinic/whatsapp`), depends on `@clinic/shared`
5. Create `packages/transcription/` — stub `package.json` (`@clinic/transcription`)
6. Create `apps/api/` — Express + TypeScript scaffold, depends on `@clinic/shared`, `@clinic/db`
7. Create `apps/workers/` — standalone Node.js + TypeScript scaffold, depends on `@clinic/shared`, `@clinic/db`
8. Create `apps/dashboard/` — Next.js App Router scaffold, depends on `@clinic/shared`
9. Configure root `tsconfig.base.json` with path aliases; each package extends it
10. Configure ESLint and Prettier at root with shared config; all packages inherit
11. Add root `npm run build` that builds all packages in dependency order

_Requirements: 1, 2_
_Skills: /code-writing-software-development — monorepo structure and TypeScript config; /build-website-web-app — Next.js scaffold_

---

## Acceptance Criteria
- [ ] `npm run build` passes across all packages with zero errors
- [ ] All shared types in `packages/shared/src/index.ts` compile without errors
- [ ] No circular dependencies between packages
- [ ] `apps/workers/package.json` does not import from `apps/api`
- [ ] ESLint and Prettier configs apply to all packages
- [ ] `/verify` passes

---

## Handoff to Next Task
**Files changed:** _(fill via /task-handoff)_
**Decisions made:** _(fill via /task-handoff)_
**Context for next task:** _(fill via /task-handoff)_
**Open questions:** _(fill via /task-handoff)_
