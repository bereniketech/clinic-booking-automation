-- Migration: 004_services
-- Tables: services, staff_services, working_hours

-- Services offered by a clinic
CREATE TABLE services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id         UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  duration_minutes  INT NOT NULL DEFAULT 30,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  active            BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_clinic_id     ON services (clinic_id);
CREATE INDEX idx_services_clinic_active ON services (clinic_id, active);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE services FORCE ROW LEVEL SECURITY;

CREATE POLICY "services_clinic_isolation"
  ON services
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);

-- Staff ↔ Services junction — which staff members can perform which services
CREATE TABLE staff_services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, service_id)
);

CREATE INDEX idx_staff_services_clinic_id  ON staff_services (clinic_id);
CREATE INDEX idx_staff_services_clinic_user ON staff_services (clinic_id, user_id);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_services FORCE ROW LEVEL SECURITY;

CREATE POLICY "staff_services_clinic_isolation"
  ON staff_services
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);

-- Working hours per staff member
CREATE TABLE working_hours (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week  INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   TIME NOT NULL,
  end_time     TIME NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

CREATE INDEX idx_working_hours_clinic_user ON working_hours (clinic_id, user_id);

ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_hours FORCE ROW LEVEL SECURITY;

CREATE POLICY "working_hours_clinic_isolation"
  ON working_hours
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
