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
  repair_id: string | null;
  sort_order: number;
  created_at: string;
}

export type InstallationRepairKind = 'repair' | 'bug_report';

export interface InstallationRepair {
  id: string;
  installation_id: string;
  occurred_on: string;
  summary: string;
  resolved: boolean;
  notes: string;
  kind: InstallationRepairKind;
  reported_by: string | null;
  notify_usernames: string[];
  created_at: string;
}

export interface InstallationRepairComment {
  id: string;
  repair_id: string;
  author_username: string;
  author_display_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface Installation {
  id: string;
  name: string;
  location: InstallationLocation;
  lifecycle_status: InstallationLifecycleStatus;
  /** User picked lifecycle on the detail page; open bugs won't override until bugs are cleared. */
  lifecycle_status_manual_override: boolean;
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
