-- Calendar project timeline (broad weekly agreements, not taskboard tasks).

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS timeline_completed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS project_timeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_project_timeline_entries_project
  ON project_timeline_entries (project_id, week_start);

CREATE TRIGGER trg_project_timeline_entries_updated_at
  BEFORE UPDATE ON project_timeline_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_timeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_timeline_entries_all ON project_timeline_entries
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
