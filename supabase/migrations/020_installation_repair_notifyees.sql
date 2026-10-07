-- Usernames to notify for bug reports (assignees) and comment emails

ALTER TABLE installation_repairs
  ADD COLUMN IF NOT EXISTS notify_usernames TEXT[] NOT NULL DEFAULT '{}';
