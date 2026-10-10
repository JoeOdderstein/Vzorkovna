-- Separate invoice-area uploads: invoices, receipts, quotations.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS document_kind TEXT NOT NULL DEFAULT 'invoice';

ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_document_kind_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_document_kind_check
  CHECK (document_kind IN ('invoice', 'receipt', 'quotation'));

CREATE INDEX IF NOT EXISTS idx_invoices_document_kind_created
  ON invoices (document_kind, created_at DESC);
