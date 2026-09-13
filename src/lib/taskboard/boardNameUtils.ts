import { ASSIGNEES, type Assignee } from './constants';

const DEFAULT_BOARD_NAMES: Record<string, Assignee> = {
  admin: 'Joost',
  gus: 'Gus',
  pasha: 'Pasha',
  vzorkovna: 'Pasha',
};

export function defaultBoardNameForUsername(username: string): Assignee | null {
  const normalized = username.trim().toLowerCase();
  if (DEFAULT_BOARD_NAMES[normalized]) {
    return DEFAULT_BOARD_NAMES[normalized];
  }

  return ASSIGNEES.find((name) => name.toLowerCase() === normalized) ?? null;
}
