-- Threaded discussion on tasks (separate from description)
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_username TEXT NOT NULL,
  author_display_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_comments_body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id_created
  ON task_comments(task_id, created_at);

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON task_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_comments_select ON task_comments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY task_comments_insert ON task_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));

CREATE POLICY task_comments_update ON task_comments
  FOR UPDATE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''))
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));

-- Enable Realtime in Supabase: Database → Publications → supabase_realtime → add task_comments
