-- Per-user read state for team messages (MESSAGES tab)
CREATE TABLE IF NOT EXISTS team_message_reads (
  message_id UUID NOT NULL REFERENCES team_messages(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, username)
);

CREATE INDEX IF NOT EXISTS idx_team_message_reads_username
  ON team_message_reads(username);

ALTER TABLE team_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_message_reads_select ON team_message_reads
  FOR SELECT TO authenticated
  USING (lower(trim(username)) = auth_taskboard_username());

CREATE POLICY team_message_reads_insert ON team_message_reads
  FOR INSERT TO authenticated
  WITH CHECK (lower(trim(username)) = auth_taskboard_username());

CREATE POLICY team_message_reads_update ON team_message_reads
  FOR UPDATE TO authenticated
  USING (lower(trim(username)) = auth_taskboard_username())
  WITH CHECK (lower(trim(username)) = auth_taskboard_username());

CREATE POLICY team_message_reads_delete ON team_message_reads
  FOR DELETE TO authenticated
  USING (lower(trim(username)) = auth_taskboard_username());
