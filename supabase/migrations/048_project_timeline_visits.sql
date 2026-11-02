-- Timeline visits: smaller blocks under phase rows (same project week grid).

ALTER TABLE project_timeline_entries
  ADD COLUMN IF NOT EXISTS entry_kind TEXT NOT NULL DEFAULT 'phase';

ALTER TABLE project_timeline_entries
  DROP CONSTRAINT IF EXISTS project_timeline_entries_entry_kind_check;

ALTER TABLE project_timeline_entries
  ADD CONSTRAINT project_timeline_entries_entry_kind_check
  CHECK (entry_kind IN ('phase', 'visit'));

ALTER TABLE project_timeline_entries
  ADD COLUMN IF NOT EXISTS parent_entry_id UUID REFERENCES project_timeline_entries(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_project_timeline_entries_parent
  ON project_timeline_entries (parent_entry_id)
  WHERE parent_entry_id IS NOT NULL;
