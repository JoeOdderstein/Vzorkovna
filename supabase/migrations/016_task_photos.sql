-- Multiple photos per task (Supabase Storage paths in task-attachments bucket)
CREATE TABLE IF NOT EXISTS task_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, storage_path)
);

CREATE INDEX IF NOT EXISTS idx_task_photos_task_id_sort
  ON task_photos(task_id, sort_order, created_at);

ALTER TABLE task_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_photos_select ON task_photos
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY task_photos_insert ON task_photos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY task_photos_delete ON task_photos
  FOR DELETE TO authenticated
  USING (true);

-- Move existing single image attachments into task_photos
INSERT INTO task_photos (task_id, storage_path, file_name, sort_order)
SELECT
  t.id,
  t.attachment_path,
  COALESCE(NULLIF(trim(t.attachment_name), ''), 'photo'),
  0
FROM tasks t
WHERE t.attachment_path IS NOT NULL
  AND t.attachment_path ~* '\.(jpg|jpeg|png|webp|gif|avif)$'
  AND NOT EXISTS (
    SELECT 1 FROM task_photos p
    WHERE p.task_id = t.id AND p.storage_path = t.attachment_path
  );

UPDATE tasks
SET attachment_path = NULL, attachment_name = NULL
WHERE attachment_path IS NOT NULL
  AND attachment_path ~* '\.(jpg|jpeg|png|webp|gif|avif)$';
