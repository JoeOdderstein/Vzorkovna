-- Admin mapping: installation (Projects page) → taskboard project for bug tasks

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS taskboard_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_installations_taskboard_project_id
  ON installations(taskboard_project_id)
  WHERE taskboard_project_id IS NOT NULL;
