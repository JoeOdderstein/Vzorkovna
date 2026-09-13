-- Installation visit periods (e.g. Prague on-site dates)
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT 'Prague visit',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_date_order CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_start ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end ON calendar_events(end_date);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_events_authenticated ON calendar_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
