import { X } from 'lucide-react';
import { useEffect } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import type { ProjectTimelineEntry } from '../../lib/taskboard/projectTimelineService';
import {
  formatTimelineWeekStartDate,
  isoWeekNumber,
  timelineSlotsInBlockRange,
  type TimelineWeekSlot,
} from '../../lib/taskboard/projectTimelineUtils';
import ProjectTimelineRichText from './ProjectTimelineRichText';

export type TimelineBlockDetail = {
  projectName: string;
  entry: ProjectTimelineEntry;
};

interface ProjectTimelineBlockDetailDialogProps {
  detail: TimelineBlockDetail | null;
  weekSlots: TimelineWeekSlot[];
  onClose: () => void;
}

export default function ProjectTimelineBlockDetailDialog({
  detail,
  weekSlots,
  onClose,
}: ProjectTimelineBlockDetailDialogProps) {
  const { t } = useTaskboardI18n();

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [detail, onClose]);

  if (!detail) return null;

  const slots = timelineSlotsInBlockRange(
    detail.entry.week_start,
    detail.entry.week_end,
    weekSlots
  );
  const weekLabel =
    slots.length === 1
      ? formatMessage(t('calendar.projectTimelineWeekLine'), {
          number: String(isoWeekNumber(slots[0].weekStart)),
          date: formatTimelineWeekStartDate(slots[0].weekStart),
        })
      : slots.length > 1
        ? `${formatMessage(t('calendar.projectTimelineWeekLine'), {
            number: String(isoWeekNumber(slots[0].weekStart)),
            date: formatTimelineWeekStartDate(slots[0].weekStart),
          })} – ${formatTimelineWeekStartDate(slots[slots.length - 1].weekStart)}`
        : '';

  return (
    <div className="taskboard fixed inset-0 z-[85] flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="timeline-block-detail-title"
        className="relative w-full max-w-lg max-h-[min(85vh,32rem)] flex flex-col rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--tb-border)] shrink-0">
          <div className="min-w-0">
            <p className="text-xs tb-muted uppercase tracking-wide">{detail.projectName}</p>
            {weekLabel ? <p className="text-xs tb-muted mt-0.5">{weekLabel}</p> : null}
            <div id="timeline-block-detail-title" className="mt-2 text-base font-semibold tb-text">
              <ProjectTimelineRichText body={detail.entry.name} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 text-[var(--tb-text-muted)] hover:tb-text"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs font-medium uppercase tracking-wide tb-muted mb-2">
            {t('calendar.projectTimelineColDescription')}
          </p>
          <ProjectTimelineRichText body={detail.entry.description} className="text-sm" />
        </div>
      </div>
    </div>
  );
}
