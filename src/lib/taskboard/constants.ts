export const TASK_CATEGORIES = [
  { id: 'quotations', label: 'Quotations & Proposals' },
  { id: 'designing', label: 'Designing' },
  { id: 'installation', label: 'Installation & Implementation' },
  { id: 'repairs', label: 'Repairs & Final Tweaks' },
] as const;

export type TaskCategory = (typeof TASK_CATEGORIES)[number]['id'];

export const ASSIGNEES = ['Gus', 'Joost', 'Pasha'] as const;
export type Assignee = (typeof ASSIGNEES)[number];

export const PRIORITIES = ['high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ALLOWED_UPLOAD_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'video/mp4',
  'video/quicktime',
];

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
