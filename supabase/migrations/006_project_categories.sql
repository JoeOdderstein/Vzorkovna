-- Project-specific task categories (admin can add per project)
CREATE TABLE IF NOT EXISTS project_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_project_categories_project_id ON project_categories(project_id);

-- Allow custom category slugs on tasks (not limited to the original enum)
ALTER TABLE tasks ALTER COLUMN category TYPE TEXT USING category::TEXT;

ALTER TABLE project_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_categories_authenticated ON project_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
