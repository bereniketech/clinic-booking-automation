-- Migration: 010_audit_logs
-- Table: audit_logs
-- BRIN index on created_at — efficient for append-only time-series data

CREATE TABLE audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  actor_id       UUID,
  actor_type     TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system')),
  action         TEXT NOT NULL,
  resource_type  TEXT NOT NULL,
  resource_id    UUID,
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_clinic_id       ON audit_logs (clinic_id);
CREATE INDEX idx_audit_logs_clinic_actor    ON audit_logs (clinic_id, actor_id);
CREATE INDEX idx_audit_logs_clinic_resource ON audit_logs (clinic_id, resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at      ON audit_logs USING BRIN (created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_clinic_isolation"
  ON audit_logs
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
