-- Migration: 009_notifications
-- Table: notification_schedules
-- bull_job_id links to BullMQ job for cancellation / deduplication

CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'cancelled', 'failed');
CREATE TYPE notification_type   AS ENUM ('reminder', 'follow_up', 'custom');

CREATE TABLE notification_schedules (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id      UUID REFERENCES customers(id) ON DELETE CASCADE,
  workflow_id      UUID REFERENCES workflows(id) ON DELETE SET NULL,
  type             notification_type NOT NULL DEFAULT 'reminder',
  scheduled_at     TIMESTAMPTZ NOT NULL,
  sent_at          TIMESTAMPTZ,
  bull_job_id      TEXT,
  status           notification_status NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_schedules_clinic_id    ON notification_schedules (clinic_id);
CREATE INDEX idx_notification_schedules_status       ON notification_schedules (clinic_id, status);
CREATE INDEX idx_notification_schedules_scheduled_at ON notification_schedules (clinic_id, scheduled_at);
CREATE INDEX idx_notification_schedules_appointment  ON notification_schedules (clinic_id, appointment_id);

ALTER TABLE notification_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_schedules FORCE ROW LEVEL SECURITY;

CREATE POLICY "notification_schedules_clinic_isolation"
  ON notification_schedules
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
