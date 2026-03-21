# Plan: Clinic Booking Automation

## Goal
Build a multi-tenant, workflow-driven clinic operating system where WhatsApp is the primary customer interface and clinics manage scheduling, CRM, messaging, and automation through a web dashboard.

## Constraints
- Node.js + TypeScript only — no Bun runtime dependency
- Supabase Auth as single auth source of truth — no mixed JWT logic
- Workers must run as a separate process — never inside the API server
- Every DB query must enforce clinic_id isolation — no cross-tenant data access
- WhatsApp handled via webhooks only — no synchronous API control

## Deliverables
The plan must produce:
- `.spec/plan.md` — high-level overview: goal, tech stack, architecture diagram, file structure
- `.spec/requirements.md` — user stories and acceptance criteria (EARS format)
- `.spec/design.md` — architecture, data models, API design, ADRs, security, performance
- `.spec/tasks.md` — ordered task list with acceptance criteria per task

## Instructions
Use /planning-specification-architecture.
Write `plan.md` first, then follow the skill's 3-phase gated workflow: requirements → user approves → design → user approves → tasks → user approves.
Do not write implementation code. Do not skip approval gates.
Save each artifact only after the user explicitly approves that phase.
