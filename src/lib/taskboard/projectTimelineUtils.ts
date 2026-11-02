import {
  htmlMessageHasContent,
  messageBodyToPlainText,
  normalizeOutgoingMessageBody,
} from '../messages/messageRichText';
import { addCalendarDays, startOfWeekMonday } from './calendarEventLayout';
import { formatDateKey, formatDateRange, parseDeadlineDate } from './deadlineUtils';

/** Monday-based week columns: ~3 years before and ~3 years after the current week. */
export const PROJECT_TIMELINE_WEEKS_BEHIND = 52 * 3;
export const PROJECT_TIMELINE_WEEKS_AHEAD = 52 * 3;

/** Roughly how many months fit on screen at the compact column width. */
export const PROJECT_TIMELINE_VIEWPORT_MONTHS = 3;

/** On load, align the left edge of the timetable to this many weeks before the current week. */
export const PROJECT_TIMELINE_INITIAL_WEEKS_BEFORE_CURRENT = 2;

/** Horizontal scroll span on the calendar project timetable (each side of the anchor month). */
export const PROJECT_TIMELINE_SCROLL_MONTHS_BEFORE = 18;
export const PROJECT_TIMELINE_SCROLL_MONTHS_AFTER = 18;

export type TimelineWeekSlot = {
  weekStart: Date;
  weekEnd: Date;
  weekStartKey: string;
  label: string;
};

/** Horizontal month header band over consecutive week columns (Monday’s month). */
export type TimelineMonthBand = {
  key: string;
  year: number;
  month: number;
  startIndex: number;
  span: number;
  label: string;
};

function timelineWeekMonthKey(slot: TimelineWeekSlot): string {
  const d = slot.weekStart;
  return `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
}

export function buildTimelineMonthBands(weekSlots: TimelineWeekSlot[]): TimelineMonthBand[] {
  if (weekSlots.length === 0) return [];

  const bands: TimelineMonthBand[] = [];
  let i = 0;
  while (i < weekSlots.length) {
    const key = timelineWeekMonthKey(weekSlots[i]);
    const startIndex = i;
    while (i < weekSlots.length && timelineWeekMonthKey(weekSlots[i]) === key) {
      i += 1;
    }
    const [yearStr, monthStr] = key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const label = new Date(year, month, 1).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
    bands.push({
      key,
      year,
      month,
      startIndex,
      span: i - startIndex,
      label,
    });
  }
  return bands;
}

/** Month header band for a calendar month (matches band year/month from week Mondays). */
export function timelineMonthBandForCalendarMonth(
  bands: TimelineMonthBand[],
  date = new Date()
): TimelineMonthBand | null {
  const year = date.getFullYear();
  const month = date.getMonth();
  return bands.find((b) => b.year === year && b.month === month) ?? null;
}

export function timelineMonthBandContainingWeekIndex(
  bands: TimelineMonthBand[],
  weekIndex: number
): TimelineMonthBand | null {
  return (
    bands.find((b) => weekIndex >= b.startIndex && weekIndex < b.startIndex + b.span) ?? null
  );
}

/** Week column index for the left edge when opening the timeline (N weeks before the current week). */
export function timelineInitialScrollWeekIndex(
  weekSlots: TimelineWeekSlot[],
  date = new Date(),
  weeksBeforeCurrent = PROJECT_TIMELINE_INITIAL_WEEKS_BEFORE_CURRENT,
): number {
  const probe = new Date(date);
  probe.setHours(0, 0, 0, 0);
  const weekIdx = weekSlots.findIndex((s) => s.weekStart <= probe && s.weekEnd >= probe);
  if (weekIdx < 0) return 0;
  return Math.max(0, weekIdx - weeksBeforeCurrent);
}

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
  anchor = new Date(),
  weeksBehind = PROJECT_TIMELINE_WEEKS_BEHIND
): TimelineWeekSlot[] {
  const anchorWeekStart = startOfWeekMonday(anchor);
  anchorWeekStart.setHours(0, 0, 0, 0);
  const firstWeekStart = addCalendarDays(anchorWeekStart, -weeksBehind * 7);

  const slots: TimelineWeekSlot[] = [];
  const totalWeeks = weeksBehind + weeksAhead;
  for (let w = 0; w < totalWeeks; w += 1) {
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

/** Week columns for the calendar timetable (scroll range before and after the anchor month). */
export function buildTimelineViewportWeekSlots(
  anchor = new Date(),
  monthsAfter = PROJECT_TIMELINE_VIEWPORT_MONTHS,
  monthsBefore = 0,
): TimelineWeekSlot[] {
  const rangeStart = new Date(anchor.getFullYear(), anchor.getMonth() - monthsBefore, 1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + monthsAfter, 0);
  rangeEnd.setHours(0, 0, 0, 0);

  let cursor = startOfWeekMonday(rangeStart);
  cursor.setHours(0, 0, 0, 0);

  const slots: TimelineWeekSlot[] = [];
  const maxWeeks = Math.max(8, (monthsBefore + monthsAfter + 2) * 5 + 6);
  while (slots.length < maxWeeks) {
    const weekStart = cursor;
    const weekEnd = addCalendarDays(weekStart, 6);
    slots.push({
      weekStart,
      weekEnd,
      weekStartKey: formatDateKey(weekStart),
      label: formatTimelineWeekLabel(weekStart, weekEnd),
    });
    if (weekEnd >= rangeEnd) break;
    cursor = addCalendarDays(cursor, 7);
  }

  return slots;
}

export function shiftTimelineViewportAnchor(anchor: Date, monthDelta: number): Date {
  return new Date(anchor.getFullYear(), anchor.getMonth() + monthDelta, 1);
}

export function formatTimelineViewportLabel(weekSlots: TimelineWeekSlot[]): string {
  const bounds = timelineAllowedDateBounds(weekSlots);
  if (!bounds) return '';
  return formatDateRange(bounds.min, bounds.max);
}

export function timelineViewportShowsBlock(
  weekSlots: TimelineWeekSlot[],
  block: Pick<TimelineBlockInput, 'week_start' | 'week_end' | 'name' | 'description'>,
): boolean {
  if (!timelineBlockHasContent(block)) return false;
  const bounds = timelineAllowedDateBounds(weekSlots);
  if (!bounds) return false;
  const { start, end } = timelineBlockDateRange(block);
  return start <= bounds.max && end >= bounds.min;
}

/** Month to show when blocks fall outside the current viewport. */
export function suggestedTimelineViewportAnchor(
  blocks: Pick<TimelineBlockInput, 'week_start' | 'week_end' | 'name' | 'description'>[],
  fallback = new Date(),
): Date {
  const today = formatDateKey(fallback);
  const withContent = blocks.filter(timelineBlockHasContent);
  if (withContent.length === 0) return fallback;

  for (const block of withContent) {
    const { start, end } = timelineBlockDateRange(block);
    if (start <= today && end >= today) {
      const d = parseDeadlineDate(start);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
  }

  let best = withContent[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const block of withContent) {
    const { start } = timelineBlockDateRange(block);
    const dist = Math.abs(parseDeadlineDate(start).getTime() - fallback.getTime());
    if (dist < bestDist) {
      bestDist = dist;
      best = block;
    }
  }
  const d = parseDeadlineDate(timelineBlockDateRange(best).start);
  return new Date(d.getFullYear(), d.getMonth(), 1);
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

/** Normalize stored range (week_start / week_end hold calendar dates, not necessarily Mondays). */
export function timelineBlockDateRange(
  block: Pick<TimelineBlockInput, 'week_start' | 'week_end'>,
): { start: string; end: string } {
  let start = block.week_start.slice(0, 10);
  let end = block.week_end.slice(0, 10);
  if (end < start) {
    [start, end] = [end, start];
  }
  return { start, end };
}

export function timelineAllowedDateBounds(
  weekSlots: TimelineWeekSlot[],
): { min: string; max: string } | null {
  if (weekSlots.length === 0) return null;
  return {
    min: weekSlots[0].weekStartKey,
    max: formatDateKey(weekSlots[weekSlots.length - 1].weekEnd),
  };
}

export function timelineDateRangeIntersectsTimeline(
  startKey: string,
  endKey: string,
  weekSlots: TimelineWeekSlot[],
): boolean {
  const bounds = timelineAllowedDateBounds(weekSlots);
  if (!bounds) return false;
  const { start, end } = timelineBlockDateRange({ week_start: startKey, week_end: endKey });
  return start <= bounds.max && end >= bounds.min;
}

export function timelineSlotsInBlockRange(
  weekStartKey: string,
  weekEndKey: string,
  slots: TimelineWeekSlot[],
): TimelineWeekSlot[] {
  const { start, end } = timelineBlockDateRange({
    week_start: weekStartKey,
    week_end: weekEndKey,
  });
  return slots.filter((slot) => {
    const slotEndKey = formatDateKey(slot.weekEnd);
    return start <= slotEndKey && end >= slot.weekStartKey;
  });
}

export type TimelineEntryKind = 'phase' | 'visit';

export type TimelineBlockInput = {
  /** Stable id for save (matches DB row id when loaded). */
  client_key: string;
  entry_kind: TimelineEntryKind;
  parent_entry_id?: string | null;
  /** Draft link to a phase row before first save. */
  parent_client_key?: string | null;
  week_start: string;
  week_end: string;
  name: string;
  description: string;
};

export function timelineEntryKind(
  block: Pick<TimelineBlockInput, 'entry_kind'>,
): TimelineEntryKind {
  return block.entry_kind === 'visit' ? 'visit' : 'phase';
}

export function isTimelinePhase(block: Pick<TimelineBlockInput, 'entry_kind'>): boolean {
  return timelineEntryKind(block) === 'phase';
}

export function isTimelineVisit(block: Pick<TimelineBlockInput, 'entry_kind'>): boolean {
  return timelineEntryKind(block) === 'visit';
}

export function timelineRichFieldHasContent(value: string): boolean {
  return htmlMessageHasContent(value);
}

export function normalizeTimelineRichField(value: string): string {
  return normalizeOutgoingMessageBody(value);
}

export function timelineBlockHasContent(block: Pick<TimelineBlockInput, 'name' | 'description'>): boolean {
  return (
    timelineRichFieldHasContent(block.name) || timelineRichFieldHasContent(block.description)
  );
}

/** Ongoing timeline: not marked completed and at least one block with name or description. */
export function isActiveProjectTimeline(state: {
  timelineCompleted: boolean;
  entries: Pick<TimelineBlockInput, 'name' | 'description'>[];
}): boolean {
  if (state.timelineCompleted) return false;
  return state.entries.some(timelineBlockHasContent);
}

export function sortTimelineBlocks(blocks: TimelineBlockInput[]): TimelineBlockInput[] {
  return blocks.slice().sort((a, b) => {
    const kindOrder = timelineEntryKind(a).localeCompare(timelineEntryKind(b));
    if (kindOrder !== 0) return kindOrder;
    const byStart = a.week_start.localeCompare(b.week_start);
    if (byStart !== 0) return byStart;
    return a.week_end.localeCompare(b.week_end);
  });
}

function validateTimelineBlocksOfKind(
  blocks: TimelineBlockInput[],
  weekSlots: TimelineWeekSlot[],
  kind: TimelineEntryKind,
): string | null {
  const normalized: { start: string; end: string }[] = [];

  for (const block of blocks) {
    if (timelineEntryKind(block) !== kind) continue;
    if (!timelineBlockHasContent(block)) continue;

    const range = timelineBlockDateRange(block);
    if (!timelineDateRangeIntersectsTimeline(range.start, range.end, weekSlots)) {
      return 'calendar.projectTimelineInvalidWeek';
    }

    normalized.push(range);
  }

  const sorted = normalized.sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.start <= prev.end) {
      return 'calendar.projectTimelineOverlap';
    }
  }

  return null;
}

/** Grid placement: week columns touched by the calendar date range. */
export function timelineBlockWeekSpan(
  rangeStartKey: string,
  rangeEndKey: string,
  weekSlots: TimelineWeekSlot[],
): { startIndex: number; span: number } | null {
  const { start, end } = timelineBlockDateRange({
    week_start: rangeStartKey,
    week_end: rangeEndKey,
  });

  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < weekSlots.length; i += 1) {
    const slot = weekSlots[i];
    const slotEndKey = formatDateKey(slot.weekEnd);
    if (start <= slotEndKey && end >= slot.weekStartKey) {
      if (startIndex < 0) startIndex = i;
      endIndex = i;
    }
  }

  if (startIndex < 0 || endIndex < 0) return null;
  return { startIndex, span: endIndex - startIndex + 1 };
}

export function timelineDefaultRangeDateKey(weekSlots: TimelineWeekSlot[]): string {
  const today = formatDateKey(new Date());
  const bounds = timelineAllowedDateBounds(weekSlots);
  if (bounds && today >= bounds.min && today <= bounds.max) return today;
  return weekSlots[0]?.weekStartKey ?? today;
}

export function timelineBlockPlainLabel(html: string): string {
  const plain = messageBodyToPlainText(html).trim();
  return plain || '—';
}

/** Returns an i18n message key if blocks overlap or fall outside allowed week keys. */
export function validateTimelineBlocks(
  blocks: TimelineBlockInput[],
  weekSlots: TimelineWeekSlot[],
): string | null {
  if (weekSlots.length === 0) return null;
  const phaseError = validateTimelineBlocksOfKind(blocks, weekSlots, 'phase');
  if (phaseError) return phaseError;
  return validateTimelineBlocksOfKind(blocks, weekSlots, 'visit');
}

export function normalizeTimelineBlocksForSave(
  blocks: TimelineBlockInput[],
  weekSlots: TimelineWeekSlot[],
): TimelineBlockInput[] {
  const out: TimelineBlockInput[] = [];

  for (const block of blocks) {
    if (!timelineBlockHasContent(block)) continue;

    const { start, end } = timelineBlockDateRange(block);
    if (!timelineDateRangeIntersectsTimeline(start, end, weekSlots)) continue;

    out.push({
      client_key: block.client_key,
      entry_kind: timelineEntryKind(block),
      parent_entry_id: block.parent_entry_id ?? null,
      parent_client_key: block.parent_client_key ?? null,
      week_start: start,
      week_end: end,
      name: normalizeTimelineRichField(block.name),
      description: normalizeTimelineRichField(block.description),
    });
  }

  return sortTimelineBlocks(out);
}

/** Row height for timetable (phases + visit strip). */
export const PROJECT_TIMELINE_ROW_MIN_PX = 96;
