-- Additive Chat domain migration. No auth/provider tables are created or altered.
ALTER TABLE message ADD COLUMN IF NOT EXISTS client_message_id uuid;
ALTER TABLE message ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS message_client_id_key ON message(conversation_id, sender_id, client_message_id);
CREATE INDEX IF NOT EXISTS message_history_cursor_idx ON message(conversation_id, created_at DESC, id DESC);
ALTER TABLE message_attachment ADD COLUMN IF NOT EXISTS media_asset_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS message_attachment_asset_key ON message_attachment(media_asset_id) WHERE media_asset_id IS NOT NULL;

-- This is Chat's transaction log/outbox, not a notification/analytics/provider queue.
CREATE TABLE IF NOT EXISTS chat_event (
  sequence bigserial PRIMARY KEY,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_event_replay_idx ON chat_event(conversation_id, sequence);
CREATE INDEX IF NOT EXISTS chat_event_entity_idx ON chat_event(entity_id, sequence DESC);
CREATE TABLE IF NOT EXISTS chat_delivery (
  event_id uuid NOT NULL REFERENCES chat_event(id) ON DELETE CASCADE,
  destination text NOT NULL CHECK(destination IN ('realtime', 'notification', 'insight', 'discovery')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  last_error text,
  PRIMARY KEY(event_id, destination)
);
CREATE INDEX IF NOT EXISTS chat_delivery_pending_idx ON chat_delivery(available_at) WHERE delivered_at IS NULL;

-- Blocking is a Chat-specific communication policy; reports remain in Resource.
CREATE TABLE IF NOT EXISTS chat_block (
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, target_id), CHECK(user_id <> target_id)
);
CREATE TABLE IF NOT EXISTS chat_call (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  callee_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('audio', 'video')),
  state text NOT NULL DEFAULT 'ringing' CHECK(state IN ('ringing', 'active', 'ended', 'rejected', 'missed')),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 seconds',
  created_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  UNIQUE(caller_id, client_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS chat_call_live_idx ON chat_call(conversation_id) WHERE state IN ('ringing', 'active');
CREATE TABLE IF NOT EXISTS chat_signal (
  sequence bigserial PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES chat_call(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('offer', 'answer', 'ice', 'accept', 'reject', 'end')),
  payload text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(call_id, sender_id, client_id)
);
