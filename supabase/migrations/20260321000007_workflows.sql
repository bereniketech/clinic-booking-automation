-- Migration: 007_workflows
-- Tables: workflows, workflow_runs

CREATE TYPE workflow_trigger    AS ENUM (
  'appointment.created',
  'appointment.completed',
  'no_response',
  'time_based'
);
CREATE TYPE workflow_run_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger     workflow_trigger NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '[]',
  actions     JSONB NOT NULL DEFAULT '[]',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflows_clinic_id     ON workflows (clinic_id);
CREATE INDEX idx_workflows_clinic_active ON workflows (clinic_id, active);
CREATE INDEX idx_workflows_conditions    ON workflows USING GIN (conditions);
CREATE INDEX idx_workflows_actions       ON workflows USING GIN (actions);

ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows FORCE ROW LEVEL SECURITY;

CREATE POLICY "workflows_clinic_isolation"
  ON workflows
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);

CREATE TABLE workflow_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  workflow_id      UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  trigger_payload  JSONB,
  status           workflow_run_status NOT NULL DEFAULT 'pending',
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ
);

CREATE INDEX idx_workflow_runs_clinic_id    ON workflow_runs (clinic_id);
CREATE INDEX idx_workflow_runs_workflow_id  ON workflow_runs (clinic_id, workflow_id);
CREATE INDEX idx_workflow_runs_status       ON workflow_runs (clinic_id, status);

ALTER TABLE workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY "workflow_runs_clinic_isolation"
  ON workflow_runs
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
