-- Migration: 011_blocks
-- Table: blocks (holidays, breaks, unavailable times)
-- Used to mark periods when a staff member is unavailable

CREATE TABLE blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT blocks_ends_after_starts CHECK (ends_at > starts_at)
);

CREATE INDEX idx_blocks_clinic_id         ON blocks (clinic_id);
CREATE INDEX idx_blocks_clinic_user_dates ON blocks (clinic_id, user_id, starts_at, ends_at);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks FORCE ROW LEVEL SECURITY;

CREATE POLICY "blocks_clinic_isolation"
  ON blocks
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
