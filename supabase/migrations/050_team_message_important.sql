-- Flag team messages as important (feed highlight + email subject)
ALTER TABLE team_messages
  ADD COLUMN IF NOT EXISTS is_important BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_team_messages_is_important
  ON team_messages (is_important)
  WHERE is_important = true;
