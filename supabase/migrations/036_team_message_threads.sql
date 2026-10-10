-- Thread replies on team messages (same topic under the root post).

ALTER TABLE team_messages
  ADD COLUMN IF NOT EXISTS thread_root_id UUID REFERENCES team_messages(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_team_messages_thread_root_created
  ON team_messages (thread_root_id, created_at ASC)
  WHERE thread_root_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_team_messages_feed_roots
  ON team_messages (created_at DESC, id DESC)
  WHERE thread_root_id IS NULL;

ALTER TABLE team_messages DROP CONSTRAINT IF EXISTS team_messages_title_not_empty;

ALTER TABLE team_messages
  ADD CONSTRAINT team_messages_title_not_empty CHECK (
    thread_root_id IS NOT NULL OR char_length(trim(title)) > 0
  );
