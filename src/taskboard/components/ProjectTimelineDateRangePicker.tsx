import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildCalendarCells } from '../../lib/taskboard/calendarEventLayout';
import { formatDateRange, parseDeadlineDate } from '../../lib/taskboard/deadlineUtils';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { timelineBlockDateRange } from '../../lib/taskboard/projectTimelineUtils';

interface ProjectTimelineDateRangePickerProps {
  startDate: string;
  endDate: string;
  minDate: string;
  maxDate: string;
  disabled?: boolean;
  onChange: (startDate: string, endDate: string) => void;
}

function isDateInRange(dateKey: string, start: string, end: string): boolean {
  return dateKey >= start && dateKey <= end;
}

export default function ProjectTimelineDateRangePicker({
  startDate,
  endDate,
  minDate,
  maxDate,
  disabled = false,
  onChange,
}: ProjectTimelineDateRangePickerProps) {
  const { t } = useTaskboardI18n();
  const range = timelineBlockDateRange({ week_start: startDate, week_end: endDate });

  const initialMonth = useMemo(() => {
    const probe = parseDeadlineDate(range.start);
    return { year: probe.getFullYear(), month: probe.getMonth() };
  }, [range.start]);

  const [viewYear, setViewYear] = useState(initialMonth.year);
  const [viewMonth, setViewMonth] = useState(initialMonth.month);
  const [anchorDate, setAnchorDate] = useState<string | null>(null);

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleDayClick = (dateKey: string) => {
    if (disabled) return;
    if (dateKey < minDate || dateKey > maxDate) return;

    if (!anchorDate) {
      setAnchorDate(dateKey);
      onChange(dateKey, dateKey);
      return;
    }

    let start = anchorDate;
    let end = dateKey;
    if (end < start) [start, end] = [end, start];
    setAnchorDate(null);
    onChange(start, end);
  };

  const weekdayLabels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  return (
    <div className="tb-project-timeline-date-range">
      <p className="text-xs tb-text font-medium mb-1">{formatDateRange(range.start, range.end)}</p>
      <p className="text-[10px] tb-muted mb-2 leading-snug">
        {t('calendar.projectTimelineDateRangeHint')}
      </p>
      <div className="flex items-center justify-between gap-2 mb-1">
        <button
          type="button"
          className="p-1 rounded tb-muted hover:tb-text disabled:opacity-40"
          disabled={disabled}
          onClick={() => shiftMonth(-1)}
          aria-label={t('calendar.projectTimelineDateRangePrevMonth')}
        >
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="text-xs font-semibold tb-text">{monthLabel}</span>
        <button
          type="button"
          className="p-1 rounded tb-muted hover:tb-text disabled:opacity-40"
          disabled={disabled}
          onClick={() => shiftMonth(1)}
          aria-label={t('calendar.projectTimelineDateRangeNextMonth')}
        >
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center mb-0.5">
        {weekdayLabels.map((label) => (
          <span key={label} className="text-[9px] font-semibold tb-muted py-0.5">
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell) => {
          if (!cell.dateKey) {
            return <span key={cell.key} className="h-7" aria-hidden />;
          }

          const inBounds = cell.dateKey >= minDate && cell.dateKey <= maxDate;
          const inRange = isDateInRange(cell.dateKey, range.start, range.end);
          const isStart = cell.dateKey === range.start;
          const isEnd = cell.dateKey === range.end;
          const isAnchor = cell.dateKey === anchorDate;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={disabled || !inBounds}
              onClick={() => handleDayClick(cell.dateKey!)}
              className={[
                'h-7 text-[11px] rounded-sm transition-colors',
                !inBounds ? 'opacity-30 cursor-not-allowed' : '',
                inRange
                  ? 'bg-[color-mix(in_srgb,var(--tb-accent)_22%,var(--tb-surface))] tb-text font-medium'
                  : 'hover:bg-[color-mix(in_srgb,var(--tb-text)_6%,transparent)] tb-text-secondary',
                isStart || isEnd || isAnchor
                  ? 'ring-1 ring-[var(--tb-accent)] font-semibold'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {cell.date!.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
