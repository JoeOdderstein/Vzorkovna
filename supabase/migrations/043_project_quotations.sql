-- Editable project budgets (quotations tab), linkable to timeline phases.

CREATE TABLE IF NOT EXISTS project_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'EUR',
  day_rate NUMERIC(12, 2),
  contingency_rate NUMERIC(8, 5),
  template_id TEXT,
  source_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_quotations_project
  ON project_quotations (project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS project_quotation_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES project_quotations(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('section', 'line', 'subtotal', 'summary')),
  label TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  unit_price NUMERIC(14, 4),
  quantity NUMERIC(14, 4),
  total NUMERIC(14, 2),
  section_category TEXT CHECK (
    section_category IS NULL
    OR section_category IN ('labour', 'materials', 'proposed', 'allowance', 'other')
  ),
  summary_key TEXT,
  timeline_entry_id UUID REFERENCES project_timeline_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_quotation_lines_quotation
  ON project_quotation_lines (quotation_id, sort_order);

CREATE TRIGGER trg_project_quotations_updated_at
  BEFORE UPDATE ON project_quotations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_quotation_lines_updated_at
  BEFORE UPDATE ON project_quotation_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE project_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_quotation_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_quotations_all ON project_quotations
  FOR ALL TO authenticated
  USING (has_invoice_area_access())
  WITH CHECK (has_invoice_area_access());

CREATE POLICY project_quotation_lines_all ON project_quotation_lines
  FOR ALL TO authenticated
  USING (has_invoice_area_access())
  WITH CHECK (has_invoice_area_access());
