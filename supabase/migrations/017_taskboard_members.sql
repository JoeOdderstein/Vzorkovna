-- Members who can log in with a self-chosen password (invite link).
-- Also allow any display name as a task assignee (not limited to the old enum).

ALTER TABLE tasks
  ALTER COLUMN assignees TYPE TEXT[] USING assignees::TEXT[];

CREATE TABLE IF NOT EXISTS taskboard_members (
  username TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  board_name TEXT NOT NULL,
  password_hash TEXT,
  invite_token_hash TEXT,
  invite_expires_at TIMESTAMPTZ,
  invite_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT taskboard_members_username_format CHECK (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  CONSTRAINT taskboard_members_email_not_empty CHECK (char_length(trim(email)) > 0),
  CONSTRAINT taskboard_members_board_name_not_empty CHECK (char_length(trim(board_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS taskboard_members_board_name_unique
  ON taskboard_members (lower(board_name));

CREATE UNIQUE INDEX IF NOT EXISTS taskboard_members_email_unique
  ON taskboard_members (lower(email));

CREATE INDEX IF NOT EXISTS taskboard_members_invite_token_hash
  ON taskboard_members (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE TRIGGER trg_taskboard_members_updated_at
  BEFORE UPDATE ON taskboard_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE taskboard_members ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: passwords and invite hashes stay service-role only.
-- Assignee names are exposed via /api/auth/assignees.
