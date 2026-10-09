-- Message title + project/category for filtering and taskboard context
ALTER TABLE team_messages
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category TEXT;

UPDATE team_messages
SET title = LEFT(trim(body), 120)
WHERE char_length(trim(title)) = 0;

CREATE INDEX IF NOT EXISTS idx_team_messages_project_id
  ON team_messages(project_id);

ALTER TABLE team_messages
  DROP CONSTRAINT IF EXISTS team_messages_title_not_empty;

ALTER TABLE team_messages
  ADD CONSTRAINT team_messages_title_not_empty CHECK (char_length(trim(title)) > 0);
