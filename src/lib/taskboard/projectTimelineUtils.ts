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
  const sameWeek = formatDateKey(weekStart) === formatDateKey(weekEnd);
  if (sameWeek) {
    return weekStart.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

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

/** ISO-8601 week number (Monday-based weeks). */
export function isoWeekNumber(date: Date): number {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - day + 3);
  const firstThursday = target.getTime();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

export function formatTimelineWeekStartDate(weekStart: Date): string {
  return weekStart.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function timelineSlotsInBlockRange(
  weekStartKey: string,
  weekEndKey: string,
  slots: TimelineWeekSlot[]
): TimelineWeekSlot[] {
  let start = weekStartKey;
  let end = weekEndKey;
  if (end < start) {
    [start, end] = [end, start];
  }
  return slots.filter(
    (slot) => slot.weekStartKey >= start && slot.weekStartKey <= end
  );
}

export type TimelineBlockInput = {
  week_start: string;
  week_end: string;
  name: string;
  description: string;
};

export function sortTimelineBlocks(blocks: TimelineBlockInput[]): TimelineBlockInput[] {
  return blocks.slice().sort((a, b) => {
    const byStart = a.week_start.localeCompare(b.week_start);
    if (byStart !== 0) return byStart;
    return a.week_end.localeCompare(b.week_end);
  });
}

function weekIndex(key: string, allowedWeekKeys: string[]): number {
  return allowedWeekKeys.indexOf(key);
}

/** Returns an i18n message key if blocks overlap or fall outside allowed week keys. */
export function validateTimelineBlocks(
  blocks: TimelineBlockInput[],
  allowedWeekKeys: string[]
): string | null {
  if (allowedWeekKeys.length === 0) return null;
  const allowed = new Set(allowedWeekKeys);

  const normalized: { start: string; end: string; startIdx: number; endIdx: number }[] = [];

  for (const block of blocks) {
    const name = block.name.trim();
    const description = block.description.trim();
    if (!name && !description) continue;

    let start = block.week_start;
    let end = block.week_end;
    if (!allowed.has(start) || !allowed.has(end)) {
      return 'calendar.projectTimelineInvalidWeek';
    }
    if (end < start) {
      [start, end] = [end, start];
    }

    const startIdx = weekIndex(start, allowedWeekKeys);
    const endIdx = weekIndex(end, allowedWeekKeys);
    if (startIdx < 0 || endIdx < 0) {
      return 'calendar.projectTimelineInvalidWeek';
    }

    normalized.push({ start, end, startIdx, endIdx: Math.max(startIdx, endIdx) });
  }

  const sorted = normalized.sort((a, b) => a.startIdx - b.startIdx);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.startIdx <= prev.endIdx) {
      return 'calendar.projectTimelineOverlap';
    }
  }

  return null;
}

export function normalizeTimelineBlocksForSave(
  blocks: TimelineBlockInput[],
  allowedWeekKeys: string[]
): TimelineBlockInput[] {
  const allowed = new Set(allowedWeekKeys);
  const out: TimelineBlockInput[] = [];

  for (const block of blocks) {
    const name = block.name.trim();
    const description = block.description.trim();
    if (!name && !description) continue;

    let start = block.week_start;
    let end = block.week_end;
    if (!allowed.has(start) || !allowed.has(end)) continue;
    if (end < start) [start, end] = [end, start];

    out.push({
      week_start: start,
      week_end: end,
      name,
      description,
    });
  }

  return sortTimelineBlocks(out);
}
