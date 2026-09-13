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

export function parseDeadlineDate(deadline: string): Date {
  return new Date(deadline + 'T00:00:00');
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDateKeyInRange(dateKey: string, startDate: string, endDate: string): boolean {
  return dateKey >= startDate && dateKey <= endDate;
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = parseDeadlineDate(startDate);
  const end = parseDeadlineDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const sameDay = sameMonth && start.getDate() === end.getDate();

  if (sameDay) {
    return start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const startFmt = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
  const endFmt = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startFmt} – ${endFmt}`;
}

export function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  return parseDeadlineDate(deadline).toLocaleDateString(undefined, {
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
