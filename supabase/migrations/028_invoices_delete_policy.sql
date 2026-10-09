-- Only the uploader may delete their invoice record.
CREATE POLICY invoices_delete ON invoices
  FOR DELETE TO authenticated
  USING (
    has_invoice_area_access()
    AND uploaded_by = auth_taskboard_username()
  );
