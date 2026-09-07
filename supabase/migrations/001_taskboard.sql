-- Taskboard schema for Haring Studio
-- Run in Supabase SQL Editor or via supabase db push

CREATE TYPE task_category AS ENUM (
  'quotations',
  'designing',
  'installation',
  'repairs'
);

CREATE TYPE task_priority AS ENUM ('high', 'normal', 'low');

CREATE TYPE task_assignee AS ENUM ('Gus', 'Joost', 'Pasha');

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  category task_category NOT NULL,
  task_name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  assigned_to task_assignee,
  priority task_priority NOT NULL DEFAULT 'normal',
  deadline DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  google_drive_url TEXT,
  attachment_path TEXT,
  attachment_name TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX idx_tasks_project_category ON tasks(project_id, category, sort_order);
CREATE INDEX idx_tasks_completed ON tasks(completed);

-- Prevent sub-subtasks
CREATE OR REPLACE FUNCTION prevent_sub_subtasks()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND parent_task_id IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Subtasks cannot have subtasks';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_sub_subtasks
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION prevent_sub_subtasks();

-- Keep subtasks in same project as parent
CREATE OR REPLACE FUNCTION enforce_subtask_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT project_id INTO STRICT NEW.project_id
    FROM tasks WHERE id = NEW.parent_task_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_subtask_project
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_subtask_project();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed projects
INSERT INTO projects (name, slug, sort_order) VALUES
  ('Tank Shots', 'tank-shots', 1),
  ('Elements Room', 'elements-room', 2),
  ('Entrance Statue', 'entrance-statue', 3),
  ('Infinity Room', 'infinity-room', 4),
  ('VR Room', 'vr-room', 5),
  ('Dog Slap Shot', 'dog-slap-shot', 6),
  ('Krakow Dragon Ribs', 'krakow-dragon-ribs', 7),
  ('Vulva Room', 'vulva-room', 8);

-- RLS: authenticated taskboard users only
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_authenticated ON projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY tasks_authenticated ON tasks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Storage bucket (run separately if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', false);
