-- Migration: 005_appointments
-- Table: appointments
-- Index: (clinic_id, staff_id, starts_at) — required by ADR-4 and acceptance criteria
-- Advisory lock pattern used at query time to prevent double-booking:
--   SELECT pg_advisory_xact_lock(hashtext(staff_id::text || starts_at::text))

CREATE TYPE appointment_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TABLE appointments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id   UUID NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  staff_id     UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  status       appointment_status NOT NULL DEFAULT 'scheduled',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_ends_after_starts CHECK (ends_at > starts_at)
);

-- Required index per acceptance criteria
CREATE INDEX idx_appointments_clinic_staff_starts ON appointments (clinic_id, staff_id, starts_at);
CREATE INDEX idx_appointments_clinic_customer     ON appointments (clinic_id, customer_id);
CREATE INDEX idx_appointments_clinic_status       ON appointments (clinic_id, status);
CREATE INDEX idx_appointments_clinic_starts       ON appointments (clinic_id, starts_at);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

CREATE POLICY "appointments_clinic_isolation"
  ON appointments
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
