-- Structured bug report questionnaire (Report bug flow)
ALTER TABLE installation_repairs
  ADD COLUMN IF NOT EXISTS bug_form JSONB;
