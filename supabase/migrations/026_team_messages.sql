-- Team message feed (MESSAGES tab) with optional linked taskboard tasks
CREATE TABLE IF NOT EXISTS team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  body TEXT NOT NULL,
  author_username TEXT NOT NULL,
  author_display_name TEXT NOT NULL DEFAULT '',
  linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT team_messages_body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_team_messages_created_at
  ON team_messages(created_at DESC);

ALTER TABLE team_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_messages_select ON team_messages
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY team_messages_insert ON team_messages
  FOR INSERT TO authenticated
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));
