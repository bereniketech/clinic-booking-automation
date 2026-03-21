---
task: 003
feature: clinic-booking-automation
status: done
depends_on: [002]
---

# Task 003: Auth — Supabase Auth + clinic_id middleware

## Session Bootstrap
> Load these before reading anything else.

Skills: /code-writing-software-development, /security-review
Commands: /verify, /task-handoff

---

## Objective
Wire up Supabase Auth as the single auth source of truth. Build Express middleware that validates the JWT and injects `clinicId` into every request. Implement clinic registration, staff invite, and role-based permission guards.

---

## Codebase Context
> [greenfield — no existing files to reference]

### Key Code Snippets

```typescript
// apps/api/src/middleware/auth.ts — pattern to implement
import { createClient } from '@supabase/supabase-js'

export interface AuthenticatedRequest extends Request {
  clinicId: string
  userId: string
  role: 'admin' | 'provider' | 'receptionist'
}

export async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: { code: 'MISSING_TOKEN' } })

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: { code: 'INVALID_TOKEN' } })

  const clinicId = user.app_metadata?.clinic_id
  if (!clinicId) return res.status(401).json({ error: { code: 'NO_CLINIC' } })

  req.clinicId = clinicId
  req.userId = user.id
  req.role = user.app_metadata?.role
  next()
}

// Role guard factory
export const requireRole = (...roles: string[]) => (req, res, next) => {
  if (!roles.includes(req.role)) {
    // log to audit_logs
    return res.status(403).json({ error: { code: 'FORBIDDEN' } })
  }
  next()
}
```

```typescript
// Clinic registration — sets clinic_id in app_metadata
// apps/api/src/routes/auth.ts
POST /api/v1/auth/register
// 1. Create clinics row
// 2. Create Supabase auth user
// 3. supabase.auth.admin.updateUserById(userId, {
//      app_metadata: { clinic_id: clinic.id, role: 'admin' }
//    })
```

### Key Patterns in Use
- **Never trust client-supplied clinic_id:** `clinicId` always comes from the validated JWT `app_metadata`, never from request body or query params.
- **Audit log on 403:** Every permission denial is written to `audit_logs` before returning.
- **Service role key for admin ops:** Clinic registration and staff invite use the Supabase service role client (never the anon key).

### Architecture Decisions Affecting This Task
- ADR-3: Supabase Auth is single source of truth — no custom JWT issuance
- ADR-4: `clinicId` injected by middleware, passed explicitly to every service function

---

## Handoff from Previous Task
**Files changed by previous task:** _(fill via /task-handoff after task-002)_
**Decisions made:** _(fill via /task-handoff)_
**Context for this task:** _(fill via /task-handoff)_
**Open questions left:** _(fill via /task-handoff)_

---

## Implementation Steps
1. Add Supabase client setup to `apps/api/src/lib/supabase.ts` (anon client + service role client)
2. Implement `authMiddleware` — validate JWT, extract `clinic_id` and `role` from `app_metadata`
3. Implement `requireRole(...roles)` guard factory with `audit_logs` write on denial
4. `POST /api/v1/auth/register` — create clinic row, create Supabase user, set `app_metadata`
5. `POST /api/v1/auth/invite` — admin only, create pending Supabase user with `clinic_id` in `app_metadata`, send invite email
6. `PATCH /api/v1/users/:id/deactivate` — admin only, set `active = false`, revoke Supabase session
7. Apply `authMiddleware` globally; exempt `/webhooks` and `/auth/register`
8. Write unit tests for middleware: missing token, invalid token, missing clinic_id, valid token, wrong role

_Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4_
_Skills: /code-writing-software-development — middleware and route patterns; /security-review — auth security checklist_

---

## Acceptance Criteria
- [x] Request without token returns 401
- [x] Request with valid token but no `clinic_id` in `app_metadata` returns 401
- [x] Request from `role: receptionist` to admin-only route returns 403 and writes to `audit_logs`
- [x] Registered clinic gets a row in `clinics` and admin user with correct `app_metadata`
- [x] Invited staff user has correct `clinic_id` in `app_metadata`
- [x] Deactivated user cannot authenticate
- [x] Unit tests for all middleware paths pass
- [x] `/verify` passes

---

## Handoff to Next Task
**Files changed:**
- `apps/api/src/lib/supabase.ts` — anon + service-role Supabase client singletons
- `apps/api/src/middleware/auth.ts` — `createAuthMiddleware` + `createRequireRole` factories
- `apps/api/src/middleware/auth.test.ts` — 10 unit tests (all passing)
- `apps/api/src/routes/auth.ts` — POST /register, POST /invite, PATCH /users/:id/deactivate
- `apps/api/src/index.ts` — express.json middleware, global auth with path exemptions, auth + users routers mounted
- `apps/api/package.json` — added @supabase/supabase-js dep, vitest devDep, updated test script

**Decisions made:**
- Auth middleware uses factory pattern (`createAuthMiddleware(supabaseClient)`) so Supabase client is injectable for tests
- `clinicId` is sourced exclusively from JWT `app_metadata.clinic_id` — never from request body/params
- Audit log writes on 403 are fire-and-forget (`void promise`) to keep response latency low
- `/health`, `/webhooks/*`, and `/api/v1/auth/register` are exempt from auth via prefix check in index.ts
- Invite creates the user row with `active: false`; deactivate uses `signOut(userId, 'others')` to revoke sessions

**Context for next task:**
- `AuthenticatedRequest` interface exposes `clinicId`, `userId`, `role` — all route handlers can extend `Request` with this type
- `requireRole('admin')` / `requireRole('admin', 'provider')` can be applied to any route handler
- Service role client (`supabaseAdmin`) is the single client for all write operations in route handlers

**Open questions:** none
