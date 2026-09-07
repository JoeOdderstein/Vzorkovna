-- Allow multiple assignees per task
-- Run in Supabase SQL Editor if you already applied 001_taskboard.sql

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees task_assignee[] NOT NULL DEFAULT '{}';

UPDATE tasks
SET assignees = ARRAY[assigned_to]::task_assignee[]
WHERE assigned_to IS NOT NULL;

ALTER TABLE tasks DROP COLUMN IF EXISTS assigned_to;
