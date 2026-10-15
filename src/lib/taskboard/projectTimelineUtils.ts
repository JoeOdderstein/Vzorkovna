import { addCalendarDays, startOfWeekMonday } from './calendarEventLayout';
import { formatDateKey } from './deadlineUtils';

export const PROJECT_TIMELINE_WEEKS_AHEAD = 10;

export type TimelineWeekSlot = {
  weekStart: Date;
  weekEnd: Date;
  weekStartKey: string;
  label: string;
};

export function formatTimelineWeekLabel(weekStart: Date, weekEnd: Date): string {
  const sameMonth =
    weekStart.getMonth() === weekEnd.getMonth() &&
    weekStart.getFullYear() === weekEnd.getFullYear();
  if (sameMonth) {
    return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString(undefined, { day: 'numeric', year: 'numeric' })}`;
  }
  const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

export function buildTimelineWeekSlots(
  weeksAhead = PROJECT_TIMELINE_WEEKS_AHEAD,
  anchor = new Date()
): TimelineWeekSlot[] {
  const firstWeekStart = startOfWeekMonday(anchor);
  firstWeekStart.setHours(0, 0, 0, 0);

  const slots: TimelineWeekSlot[] = [];
  for (let w = 0; w < weeksAhead; w += 1) {
    const weekStart = addCalendarDays(firstWeekStart, w * 7);
    const weekEnd = addCalendarDays(weekStart, 6);
    slots.push({
      weekStart,
      weekEnd,
      weekStartKey: formatDateKey(weekStart),
      label: formatTimelineWeekLabel(weekStart, weekEnd),
    });
  }
  return slots;
}
