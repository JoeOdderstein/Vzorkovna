-- Timeline entries can span multiple weeks (week_start … week_end).

ALTER TABLE project_timeline_entries
  ADD COLUMN IF NOT EXISTS week_end DATE;

UPDATE project_timeline_entries
SET week_end = week_start
WHERE week_end IS NULL;

ALTER TABLE project_timeline_entries
  ALTER COLUMN week_end SET NOT NULL;

ALTER TABLE project_timeline_entries
  DROP CONSTRAINT IF EXISTS project_timeline_entries_project_id_week_start_key;

CREATE INDEX IF NOT EXISTS idx_project_timeline_entries_project_range
  ON project_timeline_entries (project_id, week_start, week_end);
