-- Per-task opt-out for assignment / attachment notification emails
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS notify_assign_emails BOOLEAN NOT NULL DEFAULT true;
