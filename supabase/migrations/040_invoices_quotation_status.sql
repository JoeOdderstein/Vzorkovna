-- Quotation review status (separate from invoice finance / payment flags).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS quotation_status TEXT
    CHECK (quotation_status IS NULL OR quotation_status IN ('approved', 'revisions_needed')),
  ADD COLUMN IF NOT EXISTS quotation_status_by TEXT,
  ADD COLUMN IF NOT EXISTS quotation_status_at TIMESTAMPTZ;
