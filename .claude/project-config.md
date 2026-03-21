# Project Configuration

## Skill Library
- Path: C:/Users/Hp/Desktop/Experiment/claude_kit

## Selected Skills
- code-writing-software-development → skills/development/code-writing-software-development
- continuous-learning             → skills/core/continuous-learning
- strategic-compact               → skills/core/strategic-compact
- autonomous-agents-task-automation → skills/planning/autonomous-agents-task-automation
- tdd-workflow                    → skills/testing-quality/tdd-workflow
- security-review                 → skills/testing-quality/security-review
- build-website-web-app           → skills/development/build-website-web-app
- api-design                      → skills/development/api-design
- postgres-patterns               → skills/data-backend/postgres-patterns
- database-migrations             → skills/data-backend/database-migrations
- whatsapp-automation             → skills/integrations/whatsapp-automation

## Rules Active
- common
- typescript

## GitHub
- Repo: not yet created
- Branch: main
- Visibility: private

## Hosting
- Frontend: Vercel (Next.js dashboard)
- Backend API: Render (stateless, horizontally scalable)
- Workers: Render background workers (separate service)
- Domain: none

## CI/CD
- Pipeline: GitHub Actions (TBD)

## Database
- Provider: Supabase (PostgreSQL)
- Tenant isolation: clinic_id on every table, enforced on every query

## Auth
- Provider: Supabase Auth — single source of truth
- No custom JWT mixing

## Queue
- Redis + BullMQ
- Workers run as a completely separate runtime process

## Package Manager
- npm

## Environment Variables
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL
- SUPABASE_JWT_SECRET
- WHATSAPP_API_TOKEN
- WHATSAPP_PHONE_NUMBER_ID
- WHATSAPP_WEBHOOK_VERIFY_TOKEN
- REDIS_URL
- NODE_ENV
- PORT
- APP_URL
