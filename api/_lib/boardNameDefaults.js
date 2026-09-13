const ASSIGNEES = ['Gus', 'Joost', 'Pasha', 'Ksusha'];

const DEFAULT_BOARD_NAMES = {
  admin: 'Joost',
  gus: 'Gus',
  pasha: 'Pasha',
  vzorkovna: 'Pasha',
};

export function defaultBoardNameForUsername(username) {
  const normalized = String(username ?? '').trim().toLowerCase();
  if (DEFAULT_BOARD_NAMES[normalized]) {
    return DEFAULT_BOARD_NAMES[normalized];
  }

  return ASSIGNEES.find((name) => name.toLowerCase() === normalized) ?? null;
}
