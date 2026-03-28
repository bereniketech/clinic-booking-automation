-- Add reminder_offset_hours to clinics table (Task 007)
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS reminder_offset_hours INTEGER NOT NULL DEFAULT 24;

-- Add missing columns to conversations for outbound messaging (Task 009)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS wa_phone TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER NOT NULL DEFAULT 0;

-- Add slug column to forms (Task 011)
ALTER TABLE forms ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Add customer_entities table (Task 010)
CREATE TABLE IF NOT EXISTS customer_entities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_entities ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS customer_entities_clinic_id_idx ON customer_entities(clinic_id);
CREATE INDEX IF NOT EXISTS customer_entities_customer_id_idx ON customer_entities(customer_id);

-- Add workflow_trigger enum values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'message.received' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'workflow_trigger')) THEN
    ALTER TYPE workflow_trigger ADD VALUE 'message.received';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'workflow.triggered' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'workflow_trigger')) THEN
    ALTER TYPE workflow_trigger ADD VALUE 'workflow.triggered';
  END IF;
END$$;

-- Add 'skipped' to workflow_run_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'skipped' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'workflow_run_status')) THEN
    ALTER TYPE workflow_run_status ADD VALUE 'skipped';
  END IF;
END$$;
