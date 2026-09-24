export type InstallationLifecycleStatus =
  | 'concept'
  | 'implementation'
  | 'waiting_tech_approval'
  | 'operational'
  | 'maintenance_needed';

export type InstallationOperationalStatus = 'active' | 'issues' | 'broken';

export type InstallationDocumentKind = 'photo' | 'technical' | 'electrical';

export type InstallationLocation = 'my_people_bar' | 'vzorkovna' | 'krakow';

export interface InstallationDocument {
  id: string;
  installation_id: string;
  kind: InstallationDocumentKind;
  title: string;
  storage_path: string | null;
  external_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface InstallationRepair {
  id: string;
  installation_id: string;
  occurred_on: string;
  summary: string;
  resolved: boolean;
  notes: string;
  created_at: string;
}

export interface Installation {
  id: string;
  name: string;
  location: InstallationLocation;
  lifecycle_status: InstallationLifecycleStatus;
  operational_status: InstallationOperationalStatus;
  responsible_person: string | null;
  last_inspection_date: string | null;
  next_maintenance_date: string | null;
  revizni_zprava_available: boolean;
  remote_url: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InstallationRecord extends Installation {
  documents: InstallationDocument[];
  repairs: InstallationRepair[];
}
