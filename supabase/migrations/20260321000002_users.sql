-- Migration: 002_users
-- Table: users (clinic staff / admins — profiles that extend Supabase auth.users)

CREATE TYPE user_role AS ENUM ('admin', 'provider', 'receptionist');

CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'receptionist',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_clinic_id       ON users (clinic_id);
CREATE INDEX idx_users_clinic_email    ON users (clinic_id, email);

-- RLS: application sets app.clinic_id per request; RLS is the safety net
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY "users_clinic_isolation"
  ON users
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
