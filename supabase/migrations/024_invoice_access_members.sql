-- Users (besides admin) who may see the Invoices area; managed by admin via API.

CREATE TABLE IF NOT EXISTS invoice_access_members (
  username TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT,
  CONSTRAINT invoice_access_username_format CHECK (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$')
);

CREATE INDEX IF NOT EXISTS idx_invoice_access_granted_at
  ON invoice_access_members (granted_at DESC);

ALTER TABLE invoice_access_members ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: access is checked via service role in /api/auth/invoice-access.
