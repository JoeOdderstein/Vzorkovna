-- Allow quotation editors (not only admin) to archive and restore budgets.

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

  IF NOT has_quotation_edit_access() THEN
    RAISE EXCEPTION 'Quotation edit access required';
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
