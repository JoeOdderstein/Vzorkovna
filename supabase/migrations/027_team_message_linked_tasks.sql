-- Multiple taskboard tasks linked to one team message
ALTER TABLE team_messages
  ADD COLUMN IF NOT EXISTS linked_task_ids UUID[] NOT NULL DEFAULT '{}';

UPDATE team_messages
SET linked_task_ids = ARRAY[linked_task_id]
WHERE linked_task_id IS NOT NULL
  AND (linked_task_ids IS NULL OR linked_task_ids = '{}');
