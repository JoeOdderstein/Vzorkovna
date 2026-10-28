-- Admins grant quotation budget edit rights; invoice-area access alone is view-only.

CREATE TABLE IF NOT EXISTS quotation_edit_members (
  username TEXT PRIMARY KEY,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by TEXT,
  CONSTRAINT quotation_edit_username_format CHECK (username ~ '^[a-z0-9][a-z0-9_-]{1,31}$')
);

CREATE INDEX IF NOT EXISTS idx_quotation_edit_granted_at
  ON quotation_edit_members (granted_at DESC);

ALTER TABLE quotation_edit_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_quotation_edit_access()
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
      FROM quotation_edit_members
      WHERE username = auth_taskboard_username()
    );
$$;

DROP POLICY IF EXISTS project_quotations_all ON project_quotations;
DROP POLICY IF EXISTS project_quotation_lines_all ON project_quotation_lines;

CREATE POLICY project_quotations_select ON project_quotations
  FOR SELECT TO authenticated
  USING (has_invoice_area_access());

CREATE POLICY project_quotations_insert ON project_quotations
  FOR INSERT TO authenticated
  WITH CHECK (has_invoice_area_access() AND has_quotation_edit_access());

CREATE POLICY project_quotations_update ON project_quotations
  FOR UPDATE TO authenticated
  USING (has_invoice_area_access() AND has_quotation_edit_access())
  WITH CHECK (has_invoice_area_access() AND has_quotation_edit_access());

CREATE POLICY project_quotations_delete ON project_quotations
  FOR DELETE TO authenticated
  USING (has_invoice_area_access() AND has_quotation_edit_access());

CREATE POLICY project_quotation_lines_select ON project_quotation_lines
  FOR SELECT TO authenticated
  USING (has_invoice_area_access());

CREATE POLICY project_quotation_lines_insert ON project_quotation_lines
  FOR INSERT TO authenticated
  WITH CHECK (has_invoice_area_access() AND has_quotation_edit_access());

CREATE POLICY project_quotation_lines_update ON project_quotation_lines
  FOR UPDATE TO authenticated
  USING (has_invoice_area_access() AND has_quotation_edit_access())
  WITH CHECK (has_invoice_area_access() AND has_quotation_edit_access());

CREATE POLICY project_quotation_lines_delete ON project_quotation_lines
  FOR DELETE TO authenticated
  USING (has_invoice_area_access() AND has_quotation_edit_access());
