-- Migration: 008_forms
-- Tables: forms, form_responses

CREATE TABLE forms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  schema      JSONB NOT NULL DEFAULT '{}',
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_forms_clinic_id     ON forms (clinic_id);
CREATE INDEX idx_forms_clinic_active ON forms (clinic_id, active);
CREATE INDEX idx_forms_schema        ON forms USING GIN (schema);

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms FORCE ROW LEVEL SECURITY;

CREATE POLICY "forms_clinic_isolation"
  ON forms
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);

CREATE TABLE form_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  form_id      UUID NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  responses    JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_responses_clinic_form  ON form_responses (clinic_id, form_id);
CREATE INDEX idx_form_responses_customer     ON form_responses (clinic_id, customer_id);

ALTER TABLE form_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_responses FORCE ROW LEVEL SECURITY;

CREATE POLICY "form_responses_clinic_isolation"
  ON form_responses
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
