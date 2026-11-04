export const BUG_FORM_VERSION = 1 as const;

export type BugInstallationKey =
  | 'big_tankshot'
  | 'small_tankshot'
  | 'elements_room'
  | 'ursula'
  | 'vulva'
  | 'slapshot'
  | 'entrance'
  | 'traffic_light'
  | 'hallway_leds'
  | 'jager_room'
  | 'carousel'
  | 'statues'
  | 'other';

export type BugPartKey =
  | 'sensor'
  | 'control_box'
  | 'tablet'
  | 'camera'
  | 'light'
  | 'sound'
  | 'fog_haze'
  | 'other';

export type BugUsabilityKey = 'yes_normal' | 'yes_degraded' | 'no_out_of_use';

export type BugFrequencyKey = 'first_time' | 'few_times' | 'every_time' | 'getting_worse';

export type BugReportFormV1 = {
  version: typeof BUG_FORM_VERSION;
  installation: BugInstallationKey;
  installationOther: string;
  part: BugPartKey;
  partSensorDetail: string;
  partOther: string;
  occurredDate: string;
  occurredTime: string;
  durationText: string;
  usability: BugUsabilityKey;
  expectedVsActual: string;
  context: string;
  frequency: BugFrequencyKey;
  frequencySince: string;
  recentChanges: string;
  triedAlready: string;
  contactForGus: string;
};

export const BUG_INSTALLATION_ORDER: BugInstallationKey[] = [
  'big_tankshot',
  'small_tankshot',
  'elements_room',
  'ursula',
  'vulva',
  'slapshot',
  'entrance',
  'traffic_light',
  'hallway_leds',
  'jager_room',
  'carousel',
  'statues',
  'other',
];

export const BUG_PART_ORDER: BugPartKey[] = [
  'sensor',
  'control_box',
  'tablet',
  'camera',
  'light',
  'sound',
  'fog_haze',
  'other',
];

export const BUG_USABILITY_ORDER: BugUsabilityKey[] = [
  'yes_normal',
  'yes_degraded',
  'no_out_of_use',
];

export const BUG_FREQUENCY_ORDER: BugFrequencyKey[] = [
  'first_time',
  'few_times',
  'every_time',
  'getting_worse',
];

const INSTALLATION_LABELS: Record<BugInstallationKey, string> = {
  big_tankshot: 'Big TankShot',
  small_tankshot: 'Small TankShot',
  elements_room: 'Elements Room',
  ursula: 'Ursula',
  vulva: 'Vulva',
  slapshot: 'SlapShot',
  entrance: 'Entrance',
  traffic_light: 'Traffic Light',
  hallway_leds: 'Hallway LEDs',
  jager_room: 'Jäger Room',
  carousel: 'Carousel',
  statues: 'Statues',
  other: 'Other',
};

const PART_LABELS: Record<BugPartKey, string> = {
  sensor: 'A sensor',
  control_box: 'The control box',
  tablet: 'The tablet',
  camera: 'The camera',
  light: 'A light',
  sound: 'The sound',
  fog_haze: 'The fog or haze machine',
  other: 'Something else',
};

const USABILITY_LABELS: Record<BugUsabilityKey, string> = {
  yes_normal: 'Yes, normally',
  yes_degraded: 'Yes, but not properly',
  no_out_of_use: "No, it's out of use",
};

const FREQUENCY_LABELS: Record<BugFrequencyKey, string> = {
  first_time: 'First time',
  few_times: 'A few times',
  every_time: 'Every time',
  getting_worse: 'Getting worse',
};

export function installationLabel(key: BugInstallationKey, otherText: string): string {
  if (key === 'other') {
    const o = otherText.trim();
    return o ? `Other (${o})` : 'Other';
  }
  return INSTALLATION_LABELS[key];
}

export function partLabel(key: BugPartKey, sensorDetail: string, otherText: string): string {
  let base = PART_LABELS[key];
  if (key === 'sensor') {
    const d = sensorDetail.trim();
    base = d ? `Sensor (${d})` : 'Sensor';
  } else if (key === 'other') {
    const o = otherText.trim();
    base = o ? `Other (${o})` : 'Something else';
  }
  return base;
}

export function guessInstallationKeyFromName(name: string): BugInstallationKey | null {
  const n = name.toLowerCase();
  if (n.includes('downstairs') && n.includes('tank')) return 'big_tankshot';
  if (n.includes('upstairs') && n.includes('tank')) return 'small_tankshot';
  if (n.includes('elements room')) return 'elements_room';
  if (n.includes('ursula') || n.includes('entrance statue')) return 'ursula';
  if (n.includes('vulva')) return 'vulva';
  if (n.includes('slapshot') || n.includes('dog alarm')) return 'slapshot';
  if (n.includes('traffic light')) return 'traffic_light';
  if (n.includes('hallway') && n.includes('led')) return 'hallway_leds';
  if (n.includes('jäger') || n.includes('jager')) return 'jager_room';
  if (n.includes('carousel')) return 'carousel';
  if (n.includes('statues') || n.includes('statue near')) return 'statues';
  if (n.includes('entrance') && !n.includes('ursula')) return 'entrance';
  return null;
}

export function emptyBugReportForm(
  defaults?: Partial<Pick<BugReportFormV1, 'installation' | 'occurredDate'>>,
): BugReportFormV1 {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return {
    version: BUG_FORM_VERSION,
    installation: defaults?.installation ?? 'other',
    installationOther: '',
    part: 'control_box',
    partSensorDetail: '',
    partOther: '',
    occurredDate: defaults?.occurredDate ?? `${y}-${m}-${d}`,
    occurredTime: '',
    durationText: '',
    usability: 'yes_degraded',
    expectedVsActual: '',
    context: '',
    frequency: 'first_time',
    frequencySince: '',
    recentChanges: '',
    triedAlready: '',
    contactForGus: '',
  };
}

export function parseBugReportForm(raw: unknown): BugReportFormV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== BUG_FORM_VERSION) return null;
  const installation = o.installation as BugInstallationKey;
  if (!BUG_INSTALLATION_ORDER.includes(installation)) return null;
  const part = o.part as BugPartKey;
  if (!BUG_PART_ORDER.includes(part)) return null;
  const usability = o.usability as BugUsabilityKey;
  if (!BUG_USABILITY_ORDER.includes(usability)) return null;
  const frequency = o.frequency as BugFrequencyKey;
  if (!BUG_FREQUENCY_ORDER.includes(frequency)) return null;

  return {
    version: BUG_FORM_VERSION,
    installation,
    installationOther: String(o.installationOther ?? ''),
    part,
    partSensorDetail: String(o.partSensorDetail ?? ''),
    partOther: String(o.partOther ?? ''),
    occurredDate: String(o.occurredDate ?? ''),
    occurredTime: String(o.occurredTime ?? ''),
    durationText: String(o.durationText ?? ''),
    usability,
    expectedVsActual: String(o.expectedVsActual ?? ''),
    context: String(o.context ?? ''),
    frequency,
    frequencySince: String(o.frequencySince ?? ''),
    recentChanges: String(o.recentChanges ?? ''),
    triedAlready: String(o.triedAlready ?? ''),
    contactForGus: String(o.contactForGus ?? ''),
  };
}

export function validateBugReportForm(form: BugReportFormV1): string | null {
  if (form.installation === 'other' && !form.installationOther.trim()) {
    return 'Please name the installation.';
  }
  if (form.part === 'sensor' && !form.partSensorDetail.trim()) {
    return 'Please say which sensor.';
  }
  if (form.part === 'other' && !form.partOther.trim()) {
    return 'Please describe which part.';
  }
  if (!form.occurredDate.trim()) return 'Date is required.';
  if (!form.durationText.trim()) return 'Please say how long it has been like this.';
  if (!form.expectedVsActual.trim()) return 'Please describe what should have happened and what happened instead.';
  if (form.frequency !== 'first_time' && !form.frequencySince.trim()) {
    return 'Please say roughly when this started happening before.';
  }
  if (!form.contactForGus.trim()) return 'Please say who Gus can contact about this.';
  return null;
}

export function bugReportSummaryFromForm(form: BugReportFormV1): string {
  const inst = installationLabel(form.installation, form.installationOther);
  const part = partLabel(form.part, form.partSensorDetail, form.partOther);
  return `${inst} — ${part}`;
}

function line(label: string, value: string): string {
  const v = value.trim();
  return v ? `${label}\n${v}` : '';
}

export function bugReportNotesFromForm(form: BugReportFormV1, reporterName: string): string {
  const whenParts = [form.occurredDate.trim()];
  if (form.occurredTime.trim()) whenParts.push(form.occurredTime.trim());
  const whenLine = whenParts.filter(Boolean).join(' at ');

  const sections = [
    `1. Installation\n${installationLabel(form.installation, form.installationOther)}`,
    `2. Which part\n${partLabel(form.part, form.partSensorDetail, form.partOther)}`,
    line('3. When', `${whenLine}\nDuration: ${form.durationText.trim()}`),
    `4. Can it still be used?\n${USABILITY_LABELS[form.usability]}`,
    line('5. Expected vs actual', form.expectedVsActual),
    line('6. What was going on', form.context),
    `7. Has it happened before?\n${FREQUENCY_LABELS[form.frequency]}${
      form.frequency !== 'first_time' && form.frequencySince.trim()
        ? `\nStarted around: ${form.frequencySince.trim()}`
        : ''
    }`,
    line('8. Recent changes', form.recentChanges),
    line('9. Already tried', form.triedAlready),
    `11. Reporter & contact\nFilled in by: ${reporterName.trim() || '—'}\nContact for Gus: ${form.contactForGus.trim()}`,
  ];

  return sections.filter(Boolean).join('\n\n');
}

export function bugReportDisplayNotes(repair: {
  notes: string;
  bug_form?: BugReportFormV1 | null;
  reported_by?: string | null;
}): string {
  if (repair.bug_form) {
    return bugReportNotesFromForm(repair.bug_form, repair.reported_by ?? '');
  }
  return repair.notes;
}
