export type DeadlineStatus = 'completed' | 'overdue' | 'soon' | 'future' | 'none';

export function getDeadlineStatus(
  deadline: string | null,
  completed: boolean
): DeadlineStatus {
  if (completed) return 'completed';
  if (!deadline) return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(deadline + 'T00:00:00');
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays <= 3) return 'soon';
  return 'future';
}

export function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  return new Date(deadline + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const deadlineClasses: Record<DeadlineStatus, string> = {
  completed: 'text-green-700',
  overdue: 'text-red-600',
  soon: 'text-orange-600',
  future: 'text-[#5f6368]',
  none: 'text-[#80868b]',
};
