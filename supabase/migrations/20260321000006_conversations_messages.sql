-- Migration: 006_conversations_messages
-- Tables: conversations, messages

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type      AS ENUM ('text', 'audio');
CREATE TYPE message_status    AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

-- One conversation per clinic+customer pair (WhatsApp thread)
CREATE TABLE conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  last_message_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, customer_id)
);

CREATE INDEX idx_conversations_clinic_id      ON conversations (clinic_id);
CREATE INDEX idx_conversations_clinic_customer ON conversations (clinic_id, customer_id);
CREATE INDEX idx_conversations_last_message    ON conversations (clinic_id, last_message_at DESC NULLS LAST);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY "conversations_clinic_isolation"
  ON conversations
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);

-- Individual WhatsApp messages
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id        UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction        message_direction NOT NULL,
  type             message_type NOT NULL DEFAULT 'text',
  content          TEXT NOT NULL,
  transcribed      BOOLEAN NOT NULL DEFAULT false,
  wa_message_id    TEXT,
  status           message_status NOT NULL DEFAULT 'queued',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_clinic_conversation    ON messages (clinic_id, conversation_id);
CREATE INDEX idx_messages_conversation_created   ON messages (conversation_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "messages_clinic_isolation"
  ON messages
  USING (clinic_id = (current_setting('app.clinic_id'))::uuid);
