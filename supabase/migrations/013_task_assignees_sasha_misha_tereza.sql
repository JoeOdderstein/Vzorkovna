-- Add Sasha, Misha, and Tereza to task assignee options
ALTER TYPE task_assignee ADD VALUE IF NOT EXISTS 'Sasha';
ALTER TYPE task_assignee ADD VALUE IF NOT EXISTS 'Misha';
ALTER TYPE task_assignee ADD VALUE IF NOT EXISTS 'Tereza';
