import { useEffect, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import { formatQuotationMoney } from '../../lib/quotations/quotationBudgetCalc';
import {
  fetchQuotationGroupsForTimelineEntry,
  type TimelinePhaseQuotationGroup,
} from '../../lib/quotations/quotationBudgetService';
import { quotationBudgetPath } from '../../lib/quotations/quotationBudgetUrl';
import type { ProjectTimelineEntry } from '../../lib/taskboard/projectTimelineService';
import {
  formatTimelineWeekStartDate,
  isoWeekNumber,
  timelineBlockPlainLabel,
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [quotationGroups, setQuotationGroups] = useState<TimelinePhaseQuotationGroup[]>([]);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [quotationError, setQuotationError] = useState('');
  const [expandedBudgetIds, setExpandedBudgetIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detail, onClose]);

  useEffect(() => {
    if (!detail) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [detail]);

  useEffect(() => {
    setExpandedBudgetIds(new Set());
  }, [detail?.entry.id]);

  useEffect(() => {
    if (!detail) {
      setQuotationGroups([]);
      setQuotationError('');
      setQuotationLoading(false);
      return;
    }

    let cancelled = false;
    setQuotationLoading(true);
    setQuotationError('');
    void fetchQuotationGroupsForTimelineEntry(detail.entry.id)
      .then((groups) => {
        if (!cancelled) setQuotationGroups(groups);
      })
      .catch(() => {
        if (!cancelled) {
          setQuotationGroups([]);
          setQuotationError(t('calendar.projectTimelinePhaseQuotationLoadError'));
        }
      })
      .finally(() => {
        if (!cancelled) setQuotationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detail, t]);

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

  const phasePlainName = timelineBlockPlainLabel(detail.entry.name).trim() || '—';
  const quotationHeading = `${t('calendar.projectTimelinePhaseQuotation')} · ${phasePlainName} · ${detail.projectName}`;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-labelledby="timeline-block-detail-title"
      className="mt-4 rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface)] shadow-sm overflow-hidden max-h-[min(85vh,36rem)] flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3 md:px-5 md:py-4 border-b border-[var(--tb-border)]">
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
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 py-3 md:px-5 md:py-4 border-b border-[var(--tb-border)]">
          <p className="text-xs font-medium uppercase tracking-wide tb-muted mb-2">
            {t('calendar.projectTimelineColDescription')}
          </p>
          <ProjectTimelineRichText body={detail.entry.description} className="text-sm" />
        </div>

        {quotationLoading ? (
          <p className="px-4 py-3 md:px-5 text-sm tb-muted">{t('common.loading')}</p>
        ) : null}
        {quotationError ? (
          <p className="px-4 py-3 md:px-5 text-sm text-red-600">{quotationError}</p>
        ) : null}

        {!quotationLoading && !quotationError && quotationGroups.length > 0 ? (
          <div className="px-4 py-3 md:px-5 md:py-4 space-y-3">
            {quotationGroups.length > 1 ? (
              <p className="text-sm font-semibold tb-text">{quotationHeading}</p>
            ) : null}
            {quotationGroups.map((group) => {
              const expanded = expandedBudgetIds.has(group.quotationId);
              const lineCountLabel = formatMessage(t('calendar.projectTimelinePhaseQuotationLineCount'), {
                count: String(group.lines.length),
              });
              return (
                <div
                  key={group.quotationId}
                  className="rounded-md border border-[var(--tb-border)] bg-[var(--tb-bg)] overflow-hidden"
                >
                  <div className="flex items-stretch gap-1 px-2 py-1.5 bg-[color-mix(in_srgb,var(--tb-text)_4%,var(--tb-surface))] border-b border-[var(--tb-border)]">
                    <button
                      type="button"
                      className="flex-1 min-w-0 flex items-center gap-2 text-left px-1 py-1 rounded hover:bg-[color-mix(in_srgb,var(--tb-text)_6%,transparent)]"
                      aria-expanded={expanded}
                      aria-label={
                        expanded
                          ? t('calendar.projectTimelinePhaseQuotationHideLines')
                          : t('calendar.projectTimelinePhaseQuotationShowLines')
                      }
                      onClick={() =>
                        setExpandedBudgetIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.quotationId)) next.delete(group.quotationId);
                          else next.add(group.quotationId);
                          return next;
                        })
                      }
                    >
                      <ChevronDown
                        size={16}
                        className={`shrink-0 tb-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      <span className="text-sm font-semibold tb-text truncate min-w-0 flex-1">
                        {quotationGroups.length > 1 ? group.title : quotationHeading}
                      </span>
                      <span className="shrink-0 text-xs tb-muted">{lineCountLabel}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums tb-text">
                        {formatQuotationMoney(group.phaseTotal, group.currency)}
                      </span>
                    </button>
                    <Link
                      to={quotationBudgetPath(group.quotationId)}
                      className="self-center text-xs font-medium text-[var(--tb-accent)] hover:underline shrink-0 px-2 py-1"
                    >
                      {t('calendar.projectTimelinePhaseQuotationOpen')}
                    </Link>
                  </div>
                  {expanded ? (
                    <>
                      <ul className="divide-y divide-[var(--tb-border)]/70 text-sm">
                        {group.lines.map((line) => {
                          const total =
                            line.total != null && Number.isFinite(line.total)
                              ? line.total
                              : Number(line.unit_price ?? 0) * Number(line.quantity ?? 0);
                          return (
                            <li
                              key={line.id}
                              className="px-3 py-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1"
                            >
                              <div className="min-w-0">
                                <p className="tb-text font-medium">{line.label.trim() || '—'}</p>
                                {line.notes?.trim() ? (
                                  <p className="text-xs tb-muted mt-0.5">{line.notes.trim()}</p>
                                ) : null}
                              </div>
                              <p className="tabular-nums tb-text shrink-0 sm:text-right">
                                {formatQuotationMoney(total, group.currency)}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="px-3 py-2 border-t border-[var(--tb-border)] flex justify-between gap-2 text-sm font-semibold tb-text">
                        <span>{t('calendar.projectTimelinePhaseQuotationSubtotal')}</span>
                        <span className="tabular-nums">
                          {formatQuotationMoney(group.phaseTotal, group.currency)}
                        </span>
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
