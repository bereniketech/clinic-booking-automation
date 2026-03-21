-- Migration: 003_customers
-- Table: customers
-- Index: (clinic_id, phone) — required by ADR-4

CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  phone       TEXT NOT NULL,
  name        TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, phone)
);

-- Required index per acceptance criteria
CREATE INDEX idx_customers_clinic_phone ON customers (clinic_id, phone);
CREATE INDEX idx_customers_clinic_id    ON customers (clinic_id);

-- RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;

CREATE POLICY "customers_clinic_isolation"
  ON customers
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
