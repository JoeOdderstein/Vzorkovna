-- Link bug reports to taskboard tasks (bidirectional resolve sync)

ALTER TABLE installation_repairs
  ADD COLUMN IF NOT EXISTS linked_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_installation_repairs_linked_task_id
  ON installation_repairs(linked_task_id)
  WHERE linked_task_id IS NOT NULL;

INSERT INTO projects (name, slug, sort_order)
SELECT 'Installation bugs', 'installation-bugs', 999
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE slug = 'installation-bugs');
