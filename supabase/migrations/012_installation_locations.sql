-- Group installations by venue and expand catalog.

CREATE TYPE installation_location AS ENUM ('my_people_bar', 'vzorkovna', 'krakow');

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS location installation_location NOT NULL DEFAULT 'vzorkovna';

DELETE FROM installation_repairs;
DELETE FROM installation_documents;
DELETE FROM installations;

INSERT INTO installations (
  id,
  name,
  location,
  lifecycle_status,
  operational_status,
  responsible_person,
  last_inspection_date,
  next_maintenance_date,
  revizni_zprava_available,
  remote_url,
  sort_order
) VALUES
  ('mpb-wall-projection', 'Wall Projection', 'my_people_bar', 'operational', 'active', NULL, NULL, NULL, false, NULL, 1),
  ('tankshot-upstairs', 'Upstairs TankShot installation', 'my_people_bar', 'operational', 'active', 'Gus', '2026-06-12', '2026-12-12', true, NULL, 2),
  ('tankshot-downstairs', 'Downstairs TankShot installation', 'my_people_bar', 'operational', 'active', 'Gus', '2026-07-01', '2027-01-01', true, 'https://connect.raspberrypi.com/devices/c38eef8d-0c65-451e-b9ad-0c0a17b79261', 3),
  ('mpb-traffic-light', 'Traffic Light', 'my_people_bar', 'operational', 'active', NULL, NULL, NULL, false, NULL, 4),
  ('vz-skulls-lama', 'Extra Additions, Skulls & Lama Installation', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 1),
  ('vz-jager-room', 'Jäger Room & Extra Additions', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 2),
  ('vz-hallway-game-room', 'Hallway LEDs & Game Room Lights', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 3),
  ('carousel', 'Carousel', 'vzorkovna', 'implementation', 'active', 'Joost', NULL, '2027-03-01', false, NULL, 4),
  ('vz-dance-floor', 'Dance Floor', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 5),
  ('vz-statues-tanks-bar', 'Statues near Tanks Bar No. 1', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 6),
  ('dog-alarm-slapshot', 'Dog Alarm SlapShot', 'vzorkovna', 'maintenance_needed', 'broken', 'Gus', '2025-11-02', '2026-10-01', false, 'https://fierce-rabbit-7109.dataplicity.io/', 7),
  ('vulva', 'Vulva', 'vzorkovna', 'operational', 'active', 'Pasha', '2026-05-09', '2026-11-09', true, NULL, 8),
  ('ursula-entrance-statue', 'Ursula — Welcome to Vzorkovna / Entrance Statue', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 9),
  ('elements-room', 'Elements Room', 'vzorkovna', 'maintenance_needed', 'issues', 'Joost', '2026-03-18', '2026-09-28', false, NULL, 10),
  ('infinity-immersive-room', 'Infinity / Immersive Room', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 11),
  ('vr-room', 'VR Room', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 12),
  ('massive-museum', 'Massive Museum', 'vzorkovna', 'operational', 'active', NULL, NULL, NULL, false, NULL, 13),
  ('krakow-wall-projection', 'The old Wall Projection Mapping installation', 'krakow', 'operational', 'active', NULL, NULL, NULL, false, NULL, 1),
  ('feed-the-dragon', 'Feed the Dragon', 'krakow', 'operational', 'active', NULL, NULL, NULL, false, NULL, 2),
  ('little-dragon', 'Little Dragon: the head, table mounting solution, voices and sound scenarios', 'krakow', 'operational', 'active', NULL, NULL, NULL, false, NULL, 3),
  ('starry-night', 'Starry Night', 'krakow', 'concept', 'active', NULL, NULL, NULL, false, NULL, 4);

INSERT INTO installation_repairs (id, installation_id, occurred_on, summary, resolved, notes) VALUES
  ('00000000-0000-4000-8000-000000000001', 'elements-room', '2026-08-22', 'Intermittent DMX flicker on primary rig', false, 'Awaiting spare driver delivery.'),
  ('00000000-0000-4000-8000-000000000002', 'dog-alarm-slapshot', '2026-09-10', 'Controller offline — no heartbeat from edge device', false, 'Remote link unreachable; site visit scheduled.');
