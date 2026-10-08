-- PDF invoices uploaded by users with invoice-area access.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  forwarded_to_finance BOOLEAN NOT NULL DEFAULT false,
  forwarded_to_finance_by TEXT,
  forwarded_to_finance_at TIMESTAMPTZ,
  payment_received BOOLEAN NOT NULL DEFAULT false,
  payment_received_by TEXT,
  payment_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices (created_at DESC);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION public.auth_taskboard_username()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT lower(trim(COALESCE(auth.jwt() ->> 'username', '')));
$$;

CREATE OR REPLACE FUNCTION public.has_invoice_area_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth_taskboard_username() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM invoice_access_members
      WHERE username = auth_taskboard_username()
    );
$$;

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select ON invoices
  FOR SELECT TO authenticated
  USING (has_invoice_area_access());

CREATE POLICY invoices_insert ON invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    has_invoice_area_access()
    AND uploaded_by = auth_taskboard_username()
  );

CREATE POLICY invoices_update ON invoices
  FOR UPDATE TO authenticated
  USING (has_invoice_area_access())
  WITH CHECK (has_invoice_area_access());
