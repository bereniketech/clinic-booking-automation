# Implementation Plan: Clinic Booking Automation OS

- [ ] 1. Monorepo scaffold & shared infrastructure
  - Init npm workspaces root with `apps/api`, `apps/workers`, `apps/dashboard`, `packages/shared`, `packages/db`, `packages/whatsapp`, `packages/transcription`
  - Configure TypeScript, ESLint, and Prettier across all packages
  - Set up `packages/shared` with all core interfaces and types
  - _Requirements: 1, 2_
  - _Skills: /code-writing-software-development, /build-website-web-app_
  - **AC:** `npm run build` passes across all packages. All shared types compile. No circular dependencies.

- [ ] 2. Database schema & migrations
  - Write Supabase migrations for all tables: `clinics`, `users`, `customers`, `services`, `staff_services`, `appointments`, `conversations`, `messages`, `workflows`, `workflow_runs`, `forms`, `form_responses`, `notification_schedules`, `audit_logs`
  - Add `clinic_id` FK on every tenant-scoped table
  - Enable RLS and write policies for each table
  - Add indexes for common query patterns (clinic_id, phone, starts_at, conversation_id)
  - _Requirements: 1.2, 4.2, 4.3_
  - _Skills: /postgres-patterns, /database-migrations_
  - **AC:** All migrations apply cleanly. RLS policies block cross-tenant queries. Advisory lock constraint prevents double-booking.

- [ ] 3. Auth — Supabase Auth + clinic_id middleware
  - Configure Supabase Auth (email invite flow)
  - API middleware: validate JWT, extract `clinic_id` from `app_metadata`, reject missing/invalid tokens
  - Clinic registration endpoint: create `clinics` row, set `clinic_id` in new user's `app_metadata`
  - Staff invite endpoint: create pending user scoped to clinic
  - Role-based permission checks per route
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4_
  - _Skills: /code-writing-software-development, /security-review_
  - **AC:** JWT middleware rejects requests without valid token. `clinic_id` missing from `app_metadata` returns 401. Role violations return 403 and log to `audit_logs`. Cross-clinic requests are blocked at middleware.

- [ ] 4. WhatsApp webhook ingestion
  - Implement `packages/whatsapp`: Meta Cloud API client (`sendText`, `sendTemplate`, `getMediaDownloadUrl`, `downloadMedia`, `verifyWebhookSignature`)
  - `POST /api/v1/webhooks/whatsapp`: HMAC-SHA256 signature verification, parse payload, enqueue `InboundMessageJob`, return 200 immediately
  - GET challenge verification endpoint for Meta webhook setup
  - _Requirements: 5.1, 5.2, 5.3_
  - _Skills: /whatsapp-automation, /code-writing-software-development_
  - **AC:** Invalid signatures return 403 and are not enqueued. Valid messages enqueue and return 200 within 50ms. Challenge verification succeeds. Unit tests cover sig verification edge cases.

- [ ] 5. Transcription package & inbound message worker
  - Implement `packages/transcription`: Whisper API client, never-throw contract, fallback text on failure
  - Implement `InboundMessageJob` processor: upsert customer + conversation, branch on `type`, transcribe audio in-memory (discard buffer), save `Message` record, enqueue `WorkflowExecutionJob`
  - BullMQ queue setup with retry config (exponential backoff, max 3 attempts)
  - _Requirements: 5.2, 5.4, 5.5, 8.1_
  - _Skills: /whatsapp-automation, /code-writing-software-development_
  - **AC:** Text messages saved with `transcribed: false`. Audio messages transcribed, buffer discarded, saved with `transcribed: true`. Transcription failure saves fallback text, does not drop message. Customer upserted on first contact.

- [ ] 6. Scheduling engine — slot generation & booking
  - Service and staff working hours CRUD endpoints
  - Slot generation algorithm: working hours → filter existing appointments + buffers + holidays → return available slots
  - `POST /api/v1/appointments`: advisory lock per `(staff_id, starts_at)`, atomic insert, emit `AppointmentCreatedEvent` to queue
  - `PATCH /api/v1/appointments/:id`: reschedule (atomic slot swap) and cancel (release slot, remove pending reminders)
  - _Requirements: 3.1–3.5, 4.1–4.6_
  - _Skills: /code-writing-software-development, /postgres-patterns_
  - **AC:** Concurrent booking of same slot: one succeeds, one gets 409. Slots outside working hours or on holidays not returned. Cancel removes BullMQ reminder jobs. All operations enforce `clinic_id`.

- [ ] 7. Notification worker — reminders
  - `ReminderJob` processor: delayed BullMQ job scheduled on appointment creation
  - On fire: enqueue `OutboundMessageJob` with clinic's reminder template
  - Idempotency: check `notification_schedules.status` before sending — skip if already sent
  - Cancel flow: remove BullMQ job + update `notification_schedules` row on appointment cancel
  - Clinic-configurable reminder timing (24h default, overridable)
  - _Requirements: 10.1–10.5_
  - _Skills: /whatsapp-automation, /code-writing-software-development_
  - **AC:** Reminder sends exactly once per appointment. Cancellation removes pending job. Duplicate job fire is idempotent. Timing respects clinic config.

- [ ] 8. Workflow engine
  - Workflow CRUD endpoints (create, update, toggle active)
  - `WorkflowExecutionJob` processor: load active workflows for clinic matching trigger type, evaluate conditions against event payload, execute actions in order
  - Action handlers: `send_whatsapp` (enqueue OutboundMessageJob), `add_tag` (update customer), `assign_staff` (update conversation), `trigger_workflow` (enqueue new WorkflowExecutionJob)
  - Write `workflow_runs` record for every execution
  - _Requirements: 6.1–6.6_
  - _Skills: /code-writing-software-development, /autonomous-agents-task-automation_
  - **AC:** Trigger fires correct workflows only. Failed actions retry 3× then mark run as failed. `workflow_runs` log written for every execution. `trigger_workflow` action cannot create infinite loops (max depth guard).

- [ ] 9. Messaging worker — outbound
  - `OutboundMessageJob` processor: call WhatsApp `sendText` or `sendTemplate`, update message `status` (sent/failed)
  - Retry on Meta API transient errors (exponential backoff, max 3)
  - Staff reply endpoint: `POST /api/v1/conversations/:id/messages` → save message record → enqueue `OutboundMessageJob`
  - _Requirements: 5.3, 5.6, 5.7, 9.3_
  - _Skills: /whatsapp-automation, /code-writing-software-development_
  - **AC:** Message status updated to `sent` on success, `failed` after 3 retries. Staff reply appears in conversation timeline immediately (optimistic). Reply delivered to WhatsApp within 5 seconds under normal load.

- [ ] 10. CRM — customer profiles & timeline
  - `GET /api/v1/customers`: search by name/phone, filter by tag/last appointment date, clinic-scoped
  - `GET /api/v1/customers/:id/timeline`: unified feed of messages (text + transcribed voice), appointments, notes, form responses — chronological
  - Tag add/remove endpoint
  - Optional sub-entity support (e.g. `pets`) via generic `customer_entities` table
  - _Requirements: 8.1–8.5_
  - _Skills: /code-writing-software-development, /postgres-patterns_
  - **AC:** Search returns only customers for authenticated clinic. Timeline includes all event types in order. Tags immediately filterable in workflow conditions.

- [ ] 11. Dynamic forms
  - Form CRUD: create/edit form with JSON schema (field types: text, number, dropdown, date, boolean)
  - Form submission endpoint (public, clinic-scoped by slug)
  - Attach form to booking trigger: after appointment created, enqueue workflow action to send form link
  - Validate submissions against form schema; reject missing required fields
  - _Requirements: 7.1–7.5_
  - _Skills: /code-writing-software-development, /build-website-web-app_
  - **AC:** Form schema stored as JSONB. Submission validates against schema. Missing required field returns 422. Response linked to customer + clinic.

- [ ] 12. Next.js dashboard — foundation & auth
  - Next.js App Router scaffold with Supabase Auth (SSR session handling)
  - Layout: sidebar navigation (Inbox, Calendar, Appointments, CRM, Forms, Workflows, Settings)
  - Auth pages: login, invite accept
  - Role-based route guards
  - _Requirements: 9.4, 9.5_
  - _Skills: /build-website-web-app, /code-writing-software-development_
  - **AC:** Unauthenticated users redirected to login. Role guards block unauthorised routes. Session persists across refresh.

- [ ] 13. Dashboard — Inbox (real-time)
  - Conversation list with unread count, last message preview, assigned staff
  - Conversation thread view: messages with mic icon for transcribed voice, timestamps
  - Staff reply input: sends to `POST /conversations/:id/messages`
  - Supabase Realtime subscription: new messages push to inbox without refresh
  - Conversation assignment UI
  - _Requirements: 5.5, 5.6, 9.1, 9.3_
  - _Skills: /build-website-web-app, /code-writing-software-development_
  - **AC:** New inbound message appears in inbox within 2 seconds. Transcribed voice messages show mic icon + transcribed text. Staff reply delivered within 5 seconds.

- [ ] 14. Dashboard — Calendar & Appointments
  - Calendar view (day/week) showing appointments with service, customer, staff
  - Appointment list with status filters
  - New booking flow: select service → date → staff → available slot → confirm
  - Reschedule and cancel actions
  - _Requirements: 4.1–4.6, 9.2_
  - _Skills: /build-website-web-app, /code-writing-software-development_
  - **AC:** Calendar renders all appointments for clinic. Slot selection shows only available slots. Double-booking attempt shows conflict error. Cancel removes reminder.

- [ ] 15. Dashboard — Settings (services, staff, working hours, workflows)
  - Services CRUD: name, duration, buffer, price, category, assigned staff
  - Staff management: invite, roles, deactivate
  - Working hours editor per staff member
  - Holiday/block management
  - Workflow builder UI: trigger selector, condition builder, action list
  - _Requirements: 2.1–2.4, 3.1–3.5, 6.1, 9.5_
  - _Skills: /build-website-web-app, /code-writing-software-development_
  - **AC:** Service with no assigned staff not bookable. Working hours change reflects immediately in slot generation. Workflow toggle activates/deactivates execution.
