-- Physical installation records (Projects menu), separate from taskboard `projects`.

CREATE TYPE installation_lifecycle_status AS ENUM (
  'concept',
  'implementation',
  'waiting_tech_approval',
  'operational',
  'maintenance_needed'
);

CREATE TYPE installation_operational_status AS ENUM (
  'active',
  'issues',
  'broken'
);

CREATE TYPE installation_document_kind AS ENUM (
  'photo',
  'technical',
  'electrical'
);

CREATE TABLE installations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lifecycle_status installation_lifecycle_status NOT NULL DEFAULT 'concept',
  operational_status installation_operational_status NOT NULL DEFAULT 'active',
  responsible_person TEXT,
  last_inspection_date DATE,
  next_maintenance_date DATE,
  revizni_zprava_available BOOLEAN NOT NULL DEFAULT false,
  remote_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE installation_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  kind installation_document_kind NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT,
  external_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE installation_repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  resolved BOOLEAN NOT NULL DEFAULT false,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_installation_documents_installation_id ON installation_documents(installation_id);
CREATE INDEX idx_installation_repairs_installation_id ON installation_repairs(installation_id);

CREATE TRIGGER trg_installations_updated_at
  BEFORE UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE installation_repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY installations_authenticated ON installations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY installation_documents_authenticated ON installation_documents
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY installation_repairs_authenticated ON installation_repairs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO installations (
  id,
  name,
  lifecycle_status,
  operational_status,
  responsible_person,
  last_inspection_date,
  next_maintenance_date,
  revizni_zprava_available,
  remote_url,
  sort_order
) VALUES
  ('big-tankshot', 'Big Tankshot', 'operational', 'active', 'Gus', '2026-06-12', '2026-12-12', true, NULL, 1),
  ('small-tankshot', 'Small Tankshot', 'operational', 'active', 'Gus', '2026-07-01', '2027-01-01', true, 'https://connect.raspberrypi.com/devices/c38eef8d-0c65-451e-b9ad-0c0a17b79261', 2),
  ('elements-room', 'Elements Room', 'maintenance_needed', 'issues', 'Joost', '2026-03-18', '2026-09-28', false, NULL, 3),
  ('vulva-room', 'Vulva Room', 'operational', 'active', 'Pasha', '2026-05-09', '2026-11-09', true, NULL, 4),
  ('slapshot', 'Slapshot', 'maintenance_needed', 'broken', 'Gus', '2025-11-02', '2026-10-01', false, 'https://fierce-rabbit-7109.dataplicity.io/', 5),
  ('carousel', 'Carousel', 'implementation', 'active', 'Joost', NULL, '2027-03-01', false, NULL, 6);

INSERT INTO installation_repairs (id, installation_id, occurred_on, summary, resolved, notes) VALUES
  ('00000000-0000-4000-8000-000000000001', 'elements-room', '2026-08-22', 'Intermittent DMX flicker on primary rig', false, 'Awaiting spare driver delivery.'),
  ('00000000-0000-4000-8000-000000000002', 'slapshot', '2026-09-10', 'Controller offline — no heartbeat from edge device', false, 'Remote link unreachable; site visit scheduled.');
