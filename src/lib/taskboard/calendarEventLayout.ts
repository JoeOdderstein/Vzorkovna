import { formatDateKey } from './deadlineUtils';
import type { CalendarEvent } from './types';

export interface CalendarCell {
  date: Date | null;
  key: string;
  dateKey: string | null;
}

export interface CalendarEventSegment {
  event: CalendarEvent;
  weekIndex: number;
  startCol: number;
  span: number;
  lane: number;
  isEventStart: boolean;
  isEventEnd: boolean;
}

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const offset = mondayOffset(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({ date: null, key: `pad-start-${i}`, dateKey: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, key: formatDateKey(date), dateKey: formatDateKey(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `pad-end-${cells.length}`, dateKey: null });
  }

  return cells;
}

export function splitIntoWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function layoutEventSegments(events: CalendarEvent[], weeks: CalendarCell[][]) {
  const segmentsByWeek = weeks.map((week, weekIndex) => {
    const segments: CalendarEventSegment[] = [];

    for (const event of events) {
      const segment = getEventSegmentInWeek(event, week, weekIndex);
      if (segment) segments.push(segment);
    }

    return assignLanes(segments);
  });

  const maxLanesByWeek = segmentsByWeek.map((segments) =>
    segments.reduce((max, segment) => Math.max(max, segment.lane + 1), 0)
  );

  return { segmentsByWeek, maxLanesByWeek };
}

function mondayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function getEventSegmentInWeek(
  event: CalendarEvent,
  week: CalendarCell[],
  weekIndex: number
): CalendarEventSegment | null {
  let startCol = -1;
  let endCol = -1;

  week.forEach((cell, col) => {
    if (!cell.dateKey) return;
    if (cell.dateKey >= event.start_date && cell.dateKey <= event.end_date) {
      if (startCol === -1) startCol = col;
      endCol = col;
    }
  });

  if (startCol === -1 || endCol === -1) return null;

  const startDateKey = week[startCol]?.dateKey;
  const endDateKey = week[endCol]?.dateKey;

  return {
    event,
    weekIndex,
    startCol,
    span: endCol - startCol + 1,
    lane: 0,
    isEventStart: startDateKey === event.start_date,
    isEventEnd: endDateKey === event.end_date,
  };
}

function assignLanes(segments: CalendarEventSegment[]): CalendarEventSegment[] {
  const sorted = [...segments].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return b.span - a.span;
  });

  const laneEnds: number[] = [];

  for (const segment of sorted) {
    let lane = 0;
    while (laneEnds[lane] != null && laneEnds[lane] >= segment.startCol) {
      lane += 1;
    }
    segment.lane = lane;
    laneEnds[lane] = segment.startCol + segment.span - 1;
  }

  return sorted;
}

export function eventLaneHeight(maxLanes: number) {
  if (maxLanes === 0) return 0;
  const laneSize = 1.375; // rem
  const gap = 0.125; // rem
  return maxLanes * laneSize + Math.max(0, maxLanes - 1) * gap;
}
