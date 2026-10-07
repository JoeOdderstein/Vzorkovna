-- Bug reports on installation projects: metadata, photos linked to repairs, comments

ALTER TABLE installation_repairs
  ADD COLUMN IF NOT EXISTS reported_by TEXT,
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'repair';

ALTER TABLE installation_documents
  ADD COLUMN IF NOT EXISTS repair_id UUID REFERENCES installation_repairs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_installation_documents_repair_id
  ON installation_documents(repair_id);

CREATE TABLE IF NOT EXISTS installation_repair_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id UUID NOT NULL REFERENCES installation_repairs(id) ON DELETE CASCADE,
  author_username TEXT NOT NULL,
  author_display_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT installation_repair_comments_body_not_empty CHECK (char_length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_installation_repair_comments_repair_id
  ON installation_repair_comments(repair_id, created_at);

CREATE TRIGGER trg_installation_repair_comments_updated_at
  BEFORE UPDATE ON installation_repair_comments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE installation_repair_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY installation_repair_comments_select ON installation_repair_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY installation_repair_comments_insert ON installation_repair_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));

CREATE POLICY installation_repair_comments_update ON installation_repair_comments
  FOR UPDATE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''))
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));

CREATE POLICY installation_repair_comments_delete ON installation_repair_comments
  FOR DELETE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''));
