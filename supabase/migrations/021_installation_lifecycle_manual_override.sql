-- When true, open bugs do not auto-set lifecycle_status to maintenance_needed.

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS lifecycle_status_manual_override BOOLEAN NOT NULL DEFAULT false;
