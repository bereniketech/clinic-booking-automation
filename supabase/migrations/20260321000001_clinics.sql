-- Migration: 001_clinics
-- Tables: subscription_plans, clinics
-- Note: Neither table has clinic_id — clinics IS the root tenant.

-- Subscription plans (no clinic_id — shared reference data)
CREATE TABLE subscription_plans (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        TEXT NOT NULL,
  tier                        TEXT NOT NULL CHECK (tier IN ('starter', 'growth', 'enterprise')),
  max_users                   INT NOT NULL DEFAULT 5,
  max_appointments_per_month  INT NOT NULL DEFAULT 200,
  price_monthly               NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default plans
INSERT INTO subscription_plans (name, tier, max_users, max_appointments_per_month, price_monthly)
VALUES
  ('Starter',    'starter',    5,   200,  29.00),
  ('Growth',     'growth',     15,  1000, 79.00),
  ('Enterprise', 'enterprise', 100, 9999, 199.00);

-- Clinics (root tenant table — no clinic_id)
CREATE TABLE clinics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  plan_id                   UUID NOT NULL REFERENCES subscription_plans(id),
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  whatsapp_phone_number_id  TEXT,
  timezone                  TEXT NOT NULL DEFAULT 'UTC',
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clinics_status ON clinics (status);
CREATE INDEX idx_clinics_plan_id ON clinics (plan_id);
