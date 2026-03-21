# Clinic Booking Automation

## Skills — Read These Files for Coding Standards
When implementing tasks, read these files for detailed coding standards:
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/development/code-writing-software-development/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/core/continuous-learning/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/core/strategic-compact/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/planning/autonomous-agents-task-automation/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/testing-quality/tdd-workflow/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/testing-quality/security-review/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/development/build-website-web-app/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/development/api-design/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/data-backend/postgres-patterns/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/data-backend/database-migrations/SKILL.md
- C:/Users/Hp/Desktop/Experiment/claude_kit/skills/integrations/whatsapp-automation/SKILL.md

## Active Feature
Feature: initial build
Tasks: .spec/tasks/
Current task: .spec/tasks/task-005.md
Branch: main

## Architecture
- API layer (Node.js/TypeScript, REST) → emits events to queue
- Worker layer (BullMQ, separate process) → consumes events async
- Workflow engine → executes clinic-configured trigger/condition/action chains
- WhatsApp = external event system via webhooks only (not sync API calls)
- Every DB table has clinic_id — enforced on every query, no exceptions

## Start Here
1. Read `## Active Feature` above — note the current task path.
2. Open the current task file — it is self-contained.
3. Read the skill files listed in ## Skills above for coding standards.
4. Implement. Run `/task-handoff` when done.

## Reference (load on demand — do not read at session start)
- Agents: `.claude/agents/` — invoke with `@agent-name`
- Commands: `.claude/commands/` — key ones: `/verify`, `/task-handoff`, `/save-session`, `/tdd`, `/code-review`
- Config: `.claude/project-config.md` — deployment targets, env vars, hosting
- Rules: `.claude/rules/` — applied automatically

## Bug Log
Append to `bug-log.md` after any fix:
`## [YYYY-MM-DD] title | What broke: … | Root cause: … | Fix: … | Fix: … | File(s): …`

## Self-Check (before marking task done)
1. Acceptance Criteria in current task file — all pass?
2. Hardcoded values that should be env vars?
3. clinic_id enforced on all DB queries touching this feature?
4. Worker logic in worker process — not in API route?
5. `bug-log.md` updated if errors occurred?

## Output Discipline
Lead with the action. No preamble, no post-summary. Bullet points over prose.
