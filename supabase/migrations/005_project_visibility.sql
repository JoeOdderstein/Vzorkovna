-- Per-user project visibility (admin assigns who can see each project)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visible_to TEXT[] DEFAULT NULL;

-- NULL = visible to all taskboard users (existing projects stay public)
