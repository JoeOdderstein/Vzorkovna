-- Archive old project quotations (admin only).

ALTER TABLE project_quotations
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by TEXT;

CREATE INDEX IF NOT EXISTS idx_project_quotations_archived
  ON project_quotations (archived_at DESC NULLS LAST)
  WHERE archived_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_project_quotation_archived(
  p_quotation_id UUID,
  p_archived BOOLEAN
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_invoice_area_access() THEN
    RAISE EXCEPTION 'Invoice area access required';
  END IF;

  IF auth_taskboard_username() <> 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE project_quotations
  SET
    archived_at = CASE WHEN p_archived THEN now() ELSE NULL END,
    archived_by = CASE WHEN p_archived THEN auth_taskboard_username() ELSE NULL END
  WHERE id = p_quotation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotation not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_project_quotation_archived(UUID, BOOLEAN) TO authenticated;
