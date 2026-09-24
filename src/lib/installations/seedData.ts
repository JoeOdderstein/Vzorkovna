import type { InstallationLocation, InstallationRecord } from './types';

const now = '2026-09-21T00:00:00.000Z';

const PI_CONNECT_SMALL_TANKSHOT =
  'https://connect.raspberrypi.com/devices/c38eef8d-0c65-451e-b9ad-0c0a17b79261';

type SeedDef = {
  id: string;
  name: string;
  location: InstallationLocation;
  sort_order: number;
  lifecycle_status?: InstallationRecord['lifecycle_status'];
  operational_status?: InstallationRecord['operational_status'];
  responsible_person?: string | null;
  last_inspection_date?: string | null;
  next_maintenance_date?: string | null;
  revizni_zprava_available?: boolean;
  remote_url?: string | null;
  repairs?: InstallationRecord['repairs'];
};

function buildRecord(def: SeedDef): InstallationRecord {
  return {
    id: def.id,
    name: def.name,
    location: def.location,
    lifecycle_status: def.lifecycle_status ?? 'operational',
    operational_status: def.operational_status ?? 'active',
    responsible_person: def.responsible_person ?? null,
    last_inspection_date: def.last_inspection_date ?? null,
    next_maintenance_date: def.next_maintenance_date ?? null,
    revizni_zprava_available: def.revizni_zprava_available ?? false,
    remote_url: def.remote_url ?? null,
    sort_order: def.sort_order,
    created_at: now,
    updated_at: now,
    documents: [],
    repairs: def.repairs ?? [],
  };
}

const CATALOG: SeedDef[] = [
  // My People Bar
  { id: 'mpb-wall-projection', name: 'Wall Projection', location: 'my_people_bar', sort_order: 1 },
  {
    id: 'tankshot-upstairs',
    name: 'Upstairs TankShot installation',
    location: 'my_people_bar',
    sort_order: 2,
    responsible_person: 'Gus',
    last_inspection_date: '2026-06-12',
    next_maintenance_date: '2026-12-12',
    revizni_zprava_available: true,
  },
  {
    id: 'tankshot-downstairs',
    name: 'Downstairs TankShot installation',
    location: 'my_people_bar',
    sort_order: 3,
    responsible_person: 'Gus',
    last_inspection_date: '2026-07-01',
    next_maintenance_date: '2027-01-01',
    revizni_zprava_available: true,
    remote_url: PI_CONNECT_SMALL_TANKSHOT,
  },
  { id: 'mpb-traffic-light', name: 'Traffic Light', location: 'my_people_bar', sort_order: 4 },

  // Vzorkovna
  {
    id: 'vz-skulls-lama',
    name: 'Extra Additions, Skulls & Lama Installation',
    location: 'vzorkovna',
    sort_order: 1,
  },
  {
    id: 'vz-jager-room',
    name: 'Jäger Room & Extra Additions',
    location: 'vzorkovna',
    sort_order: 2,
  },
  {
    id: 'vz-hallway-game-room',
    name: 'Hallway LEDs & Game Room Lights',
    location: 'vzorkovna',
    sort_order: 3,
  },
  {
    id: 'carousel',
    name: 'Carousel',
    location: 'vzorkovna',
    sort_order: 4,
    lifecycle_status: 'implementation',
    responsible_person: 'Joost',
    next_maintenance_date: '2027-03-01',
  },
  { id: 'vz-dance-floor', name: 'Dance Floor', location: 'vzorkovna', sort_order: 5 },
  {
    id: 'vz-statues-tanks-bar',
    name: 'Statues near Tanks Bar No. 1',
    location: 'vzorkovna',
    sort_order: 6,
  },
  {
    id: 'dog-alarm-slapshot',
    name: 'Dog Alarm SlapShot',
    location: 'vzorkovna',
    sort_order: 7,
    lifecycle_status: 'maintenance_needed',
    operational_status: 'broken',
    responsible_person: 'Gus',
    last_inspection_date: '2025-11-02',
    next_maintenance_date: '2026-10-01',
    remote_url: 'https://fierce-rabbit-7109.dataplicity.io/',
    repairs: [
      {
        id: 'repair-dog-alarm-slapshot-1',
        installation_id: 'dog-alarm-slapshot',
        occurred_on: '2026-09-10',
        summary: 'Controller offline — no heartbeat from edge device',
        resolved: false,
        notes: 'Remote link unreachable; site visit scheduled.',
        created_at: now,
      },
    ],
  },
  {
    id: 'vulva',
    name: 'Vulva',
    location: 'vzorkovna',
    sort_order: 8,
    responsible_person: 'Pasha',
    last_inspection_date: '2026-05-09',
    next_maintenance_date: '2026-11-09',
    revizni_zprava_available: true,
  },
  {
    id: 'ursula-entrance-statue',
    name: 'Ursula — Welcome to Vzorkovna / Entrance Statue',
    location: 'vzorkovna',
    sort_order: 9,
  },
  {
    id: 'elements-room',
    name: 'Elements Room',
    location: 'vzorkovna',
    sort_order: 10,
    lifecycle_status: 'maintenance_needed',
    operational_status: 'issues',
    responsible_person: 'Joost',
    last_inspection_date: '2026-03-18',
    next_maintenance_date: '2026-09-28',
    repairs: [
      {
        id: 'repair-elements-room-1',
        installation_id: 'elements-room',
        occurred_on: '2026-08-22',
        summary: 'Intermittent DMX flicker on primary rig',
        resolved: false,
        notes: 'Awaiting spare driver delivery.',
        created_at: now,
      },
    ],
  },
  {
    id: 'infinity-immersive-room',
    name: 'Infinity / Immersive Room',
    location: 'vzorkovna',
    sort_order: 11,
  },
  { id: 'vr-room', name: 'VR Room', location: 'vzorkovna', sort_order: 12 },
  { id: 'massive-museum', name: 'Massive Museum', location: 'vzorkovna', sort_order: 13 },

  // Kraków
  {
    id: 'krakow-wall-projection',
    name: 'The old Wall Projection Mapping installation',
    location: 'krakow',
    sort_order: 1,
  },
  { id: 'feed-the-dragon', name: 'Feed the Dragon', location: 'krakow', sort_order: 2 },
  {
    id: 'little-dragon',
    name: 'Little Dragon: the head, table mounting solution, voices and sound scenarios',
    location: 'krakow',
    sort_order: 3,
  },
  {
    id: 'starry-night',
    name: 'Starry Night',
    location: 'krakow',
    sort_order: 4,
    lifecycle_status: 'concept',
    operational_status: 'active',
  },
];

export const INSTALLATION_SEED_RECORDS: InstallationRecord[] = CATALOG.map(buildRecord);
