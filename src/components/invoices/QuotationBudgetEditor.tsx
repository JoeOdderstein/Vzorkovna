import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { FileDown, X } from 'lucide-react';
import { downloadQuotationBudgetPdf } from '../../lib/quotations/downloadQuotationBudgetPdf';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import type { Project } from '../../lib/taskboard/types';
import { fetchProjectTimeline } from '../../lib/taskboard/projectTimelineService';
import { timelineBlockPlainLabel } from '../../lib/taskboard/projectTimelineUtils';
import {
  formatQuotationMoney,
  recomputeQuotationLines,
} from '../../lib/quotations/quotationBudgetCalc';
import { addEmptyLineAfter, addEmptySection } from '../../lib/quotations/emptyQuotationDraft';
import {
  attachDragKeys,
  lineSortableIds,
  moveQuotationLine,
  removeQuotationLineAt,
  stripDragKeys,
  type QuotationLineWithDragKey,
} from '../../lib/quotations/quotationLineDrag';
import type { ProjectQuotation } from '../../lib/quotations/types';
import { saveProjectQuotation } from '../../lib/quotations/quotationBudgetService';
import {
  DraggableLineRow,
  LineRowCells,
  SectionDropRow,
} from './QuotationBudgetDraggableRows';
interface QuotationBudgetEditorProps {
  quotation: ProjectQuotation;
  projects: Project[];
  readOnly?: boolean;
  onClose: () => void;
  onSaved: (updated: ProjectQuotation) => void;
}

export default function QuotationBudgetEditor({
  quotation,
  projects,
  readOnly = false,
  onClose,
  onSaved,
}: QuotationBudgetEditorProps) {
  const { t } = useTaskboardI18n();
  const [title, setTitle] = useState(quotation.title);
  const [subtitle, setSubtitle] = useState(quotation.subtitle);
  const [projectId, setProjectId] = useState(quotation.project_id);
  const [dayRate, setDayRate] = useState(String(quotation.day_rate ?? ''));
  const [contingencyRate, setContingencyRate] = useState(String(quotation.contingency_rate ?? 0.075));
  const [lines, setLines] = useState<QuotationLineWithDragKey[]>(() =>
    attachDragKeys(quotation.lines ?? []),
  );
  const [activeDragKey, setActiveDragKey] = useState<string | null>(null);
  const [phaseOptions, setPhaseOptions] = useState<{ id: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState('');

  const currency = quotation.currency || 'EUR';

  const plainLines = useMemo(() => stripDragKeys(lines), [lines]);

  const computedLines = useMemo(() => {
    const rate = Number(contingencyRate) || 0;
    return recomputeQuotationLines(plainLines, rate);
  }, [plainLines, contingencyRate]);

  const sortableIds = useMemo(() => lineSortableIds(lines), [lines]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchProjectTimeline(projectId)
      .then((state) => {
        if (cancelled) return;
        setPhaseOptions(
          state.entries.map((entry) => ({
            id: entry.id,
            label: timelineBlockPlainLabel(entry.name) || 'Phase',
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setPhaseOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const updateLine = useCallback((index: number, patch: Partial<QuotationLineWithDragKey>) => {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }, []);

  const removeLine = useCallback((index: number) => {
    setLines((prev) => removeQuotationLineAt(prev, index));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragKey(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragKey(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLines((prev) => moveQuotationLine(prev, String(active.id), String(over.id)));
  };

  const handleDragCancel = () => {
    setActiveDragKey(null);
  };

  const activeLine = activeDragKey
    ? lines.find((line) => line.dragKey === activeDragKey && line.kind === 'line')
    : null;

  const activeLineIndex = activeLine ? lines.indexOf(activeLine) : -1;
  const activeComputed =
    activeLineIndex >= 0 ? computedLines[activeLineIndex] : null;

  const renderStaticRows = () =>
    computedLines.map((row, index) => {
      const lineState = lines[index];
      if (row.kind === 'section') {
        return (
          <tr
            key={`${lineState?.dragKey ?? index}-section`}
            className="quotation-budget-section-row bg-[color-mix(in_srgb,var(--tb-text)_5%,var(--tb-surface))]"
          >
            <td colSpan={5} className="py-1 md:py-2 pr-1 md:pr-2 quotation-budget-section-cell">
              <p className="text-xs md:text-sm font-semibold tb-text px-0.5">{lineState?.label || '—'}</p>
            </td>
            <td className="quotation-budget-total-col quotation-budget-total-col--section" aria-hidden />
          </tr>
        );
      }
      if (row.kind === 'subtotal') {
        return (
          <tr
            key={`${lineState?.dragKey ?? index}-subtotal`}
            className="border-t border-[var(--tb-border)] font-semibold quotation-budget-subtotal-row"
          >
            <td colSpan={5} className="py-1 md:py-1.5 pr-1 md:pr-2">
              <p className="text-xs md:text-sm font-semibold text-right">{lineState?.label}</p>
            </td>
            <td className="quotation-budget-total-col py-1 md:py-1.5 text-right tabular-nums">
              {formatQuotationMoney(row.total, currency)}
            </td>
          </tr>
        );
      }
      if (row.kind === 'summary') {
        return (
          <tr
            key={`${row.summary_key ?? row.label}-${index}`}
            className="border-t border-[var(--tb-border)] font-semibold quotation-budget-summary-row"
          >
            <td colSpan={5} className="py-1 md:py-1.5 pr-1 md:pr-2 text-right tb-text">
              {row.label}
            </td>
            <td className="quotation-budget-total-col py-1 md:py-1.5 text-right tabular-nums">
              {formatQuotationMoney(row.total, currency)}
            </td>
          </tr>
        );
      }
      if (!lineState) return null;
      return (
        <tr key={lineState.dragKey} className="border-b border-[var(--tb-border)]/60 quotation-budget-line-row">
          <LineRowCells
            line={lineState}
            index={index}
            phaseOptions={phaseOptions}
            onPatch={() => {}}
            t={t}
            readOnly
          />
          <td className="quotation-budget-total-col py-1 text-right tabular-nums align-top">
            {formatQuotationMoney(row.total, currency)}
          </td>
        </tr>
      );
    });

  const tableClassName =
    'w-full min-w-[640px] sm:min-w-[720px] lg:min-w-[980px] text-xs md:text-sm border-collapse quotation-budget-table';

  const projectName = projects.find((p) => p.id === projectId)?.name ?? '—';

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setError('');
    try {
      await downloadQuotationBudgetPdf({
        title,
        subtitle,
        projectName,
        currency,
        dayRate: dayRate === '' ? null : Number(dayRate),
        contingencyRate: contingencyRate === '' ? null : Number(contingencyRate),
        lines: computedLines,
        phaseLabelFor: (id) =>
          phaseOptions.find((opt) => opt.id === id)?.label ?? t('quotations.phaseNone'),
      });
    } catch {
      setError(t('quotations.downloadPdfError'));
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await saveProjectQuotation(quotation.id, {
        project_id: projectId,
        title,
        subtitle,
        currency,
        day_rate: dayRate === '' ? null : Number(dayRate),
        contingency_rate: contingencyRate === '' ? null : Number(contingencyRate),
        template_id: quotation.template_id,
        lines: computedLines,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetSaveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[88] flex flex-col bg-[var(--tb-bg)] w-full max-w-[100vw] h-[100dvh] max-h-[100dvh] overflow-hidden">
      <div className="shrink-0 border-b border-[var(--tb-border)] bg-[var(--tb-surface)] px-3 md:px-8 py-3 md:py-4 flex flex-col md:flex-row items-start justify-between gap-3 md:gap-4 min-w-0">
        <div className="min-w-0 flex-1 space-y-2 md:space-y-3 w-full">
          {readOnly ? (
            <>
              <h2 className="text-base md:text-lg font-semibold tb-text truncate max-w-3xl">{title || '—'}</h2>
              {subtitle ? <p className="text-xs md:text-sm tb-muted max-w-3xl">{subtitle}</p> : null}
              <div className="flex flex-wrap gap-4 text-xs tb-muted">
                <span>
                  {t('task.project')}: {projects.find((p) => p.id === projectId)?.name ?? '—'}
                </span>
                <span>
                  {t('quotations.dayRate')}: {dayRate || '—'}
                </span>
                <span>
                  {t('quotations.contingency')}: {contingencyRate || '—'}
                </span>
              </div>
            </>
          ) : (
            <>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('quotations.budgetTitlePlaceholder')}
                className="field-input text-base md:text-lg font-semibold w-full max-w-3xl"
                aria-label={t('quotations.budgetTitle')}
              />
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={t('quotations.budgetSubtitlePlaceholder')}
                className="field-input text-sm w-full max-w-3xl"
                aria-label={t('quotations.budgetSubtitle')}
              />
              <div className="flex flex-wrap gap-3 items-end">
                <label className="text-xs tb-muted">
                  {t('task.project')}
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="field-input mt-1 block min-w-[12rem]"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs tb-muted">
                  {t('quotations.dayRate')}
                  <input
                    type="number"
                    step="0.01"
                    value={dayRate}
                    onChange={(e) => setDayRate(e.target.value)}
                    className="field-input mt-1 block w-28"
                  />
                </label>
                <label className="text-xs tb-muted">
                  {t('quotations.contingency')}
                  <input
                    type="number"
                    step="0.001"
                    value={contingencyRate}
                    onChange={(e) => setContingencyRate(e.target.value)}
                    className="field-input mt-1 block w-28"
                  />
                </label>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {readOnly ? (
            <span className="text-xs tb-muted px-2 py-1 rounded border border-[var(--tb-border)]">
              {t('quotations.viewOnlyBadge')}
            </span>
          ) : null}
          <button
            type="button"
            className="tb-btn-secondary text-sm inline-flex items-center gap-1.5"
            disabled={saving || downloadingPdf}
            onClick={() => void handleDownloadPdf()}
          >
            <FileDown size={16} aria-hidden />
            {downloadingPdf ? t('common.loading') : t('quotations.downloadPdf')}
          </button>
          <button type="button" className="tb-btn-secondary text-sm" disabled={saving} onClick={onClose}>
            {readOnly ? t('common.close') : t('common.cancel')}
          </button>
          {!readOnly ? (
            <button type="button" className="tb-btn-primary text-sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="tb-muted p-1" aria-label={t('common.close')}>
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-auto px-3 md:px-8 py-3 md:py-4">
        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
        {!readOnly ? <p className="text-xs tb-muted mb-2">{t('quotations.dragHint')}</p> : null}
        {!readOnly ? (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              className="tb-btn-secondary text-xs"
              onClick={() =>
                setLines((prev) => attachDragKeys(addEmptySection(stripDragKeys(prev))))
              }
            >
              {t('quotations.addSection')}
            </button>
            <button
              type="button"
              className="tb-btn-secondary text-xs"
              onClick={() =>
                setLines((prev) => {
                  const stripped = stripDragKeys(prev);
                  const lastLineIdx = stripped.reduce(
                    (acc, row, i) => (row.kind === 'line' ? i : acc),
                    -1,
                  );
                  const next =
                    lastLineIdx < 0 ? addEmptySection(stripped) : addEmptyLineAfter(stripped, lastLineIdx);
                  return attachDragKeys(next);
                })
              }
            >
              {t('quotations.addLine')}
            </button>
          </div>
        ) : null}

        <div className="min-w-0 overflow-x-auto overscroll-x-contain">
          {readOnly ? (
            <table className={tableClassName}>
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide tb-muted border-b border-[var(--tb-border)]">
                  <th className="quotation-budget-phase-col py-1 md:py-2 pr-1 md:pr-2 w-28 lg:w-44">
                    {t('quotations.colPhase')}
                  </th>
                  <th className="py-1 md:py-2 pr-1 md:pr-2 min-w-[5rem]">{t('quotations.colItem')}</th>
                  <th className="py-1 md:py-2 pr-1 md:pr-2 w-[18%] lg:w-[28%]">{t('quotations.colNotes')}</th>
                  <th className="quotation-budget-unit-col py-1 md:py-2 pr-1 md:pr-2 w-16 lg:w-24 text-right">
                    {t('quotations.colUnit')}
                  </th>
                  <th className="quotation-budget-qty-col py-1 md:py-2 pr-1 md:pr-2 w-14 lg:w-20 text-right">
                    {t('quotations.colQty')}
                  </th>
                  <th className="quotation-budget-total-col py-1 md:py-2 text-right w-20 lg:w-28">
                    {t('quotations.colTotal')}
                  </th>
                </tr>
              </thead>
              <tbody>{renderStaticRows()}</tbody>
            </table>
          ) : null}

          {!readOnly ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <table className={tableClassName}>
                  <thead>
                    <tr className="text-left text-[10px] uppercase tracking-wide tb-muted border-b border-[var(--tb-border)]">
                      <th className="py-1 md:py-2 w-7 lg:w-8" aria-hidden />
                      <th className="quotation-budget-phase-col py-1 md:py-2 pr-1 md:pr-2 w-28 lg:w-44">
                        {t('quotations.colPhase')}
                      </th>
                      <th className="py-1 md:py-2 pr-1 md:pr-2 min-w-[5rem]">{t('quotations.colItem')}</th>
                      <th className="py-1 md:py-2 pr-1 md:pr-2 w-[18%] lg:w-[28%]">{t('quotations.colNotes')}</th>
                      <th className="quotation-budget-unit-col py-1 md:py-2 pr-1 md:pr-2 w-16 lg:w-24 text-right">
                        {t('quotations.colUnit')}
                      </th>
                      <th className="quotation-budget-qty-col py-1 md:py-2 pr-1 md:pr-2 w-14 lg:w-20 text-right">
                        {t('quotations.colQty')}
                      </th>
                      <th className="quotation-budget-total-col py-1 md:py-2 text-right w-20 lg:w-28">
                        {t('quotations.colTotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedLines.map((row, index) => {
                      const lineState = lines[index];
                      if (row.kind === 'section') {
                        return (
                          <SectionDropRow key={`${lineState?.dragKey ?? index}-section`} sectionIndex={index}>
                            <td colSpan={6} className="py-1 md:py-2 pr-1 md:pr-2 quotation-budget-section-cell">
                              <input
                                value={lineState?.label ?? ''}
                                onChange={(e) => updateLine(index, { label: e.target.value })}
                                placeholder={t('quotations.sectionNamePlaceholder')}
                                className="field-input text-xs md:text-sm font-semibold w-full"
                              />
                              <span className="sr-only">{t('quotations.sectionDropTarget')}</span>
                            </td>
                            <td className="quotation-budget-total-col quotation-budget-total-col--section" aria-hidden />
                          </SectionDropRow>
                        );
                      }
                      if (row.kind === 'subtotal') {
                        return (
                          <tr
                            key={`${lineState?.dragKey ?? index}-subtotal`}
                            className="border-t border-[var(--tb-border)] font-semibold quotation-budget-subtotal-row"
                          >
                            <td aria-hidden />
                            <td colSpan={5} className="py-1 md:py-1.5 pr-1 md:pr-2">
                              <input
                                value={lineState?.label ?? ''}
                                onChange={(e) => updateLine(index, { label: e.target.value })}
                                className="field-input text-xs md:text-sm font-semibold w-full text-right"
                              />
                            </td>
                            <td className="quotation-budget-total-col py-1 md:py-1.5 text-right tabular-nums">
                              {formatQuotationMoney(row.total, currency)}
                            </td>
                          </tr>
                        );
                      }
                      if (row.kind === 'summary') {
                        return (
                          <tr
                            key={`${row.summary_key ?? row.label}-${index}`}
                            className="border-t border-[var(--tb-border)] font-semibold quotation-budget-summary-row"
                          >
                            <td aria-hidden />
                            <td colSpan={5} className="py-1 md:py-1.5 pr-1 md:pr-2 text-right tb-text">
                              {row.label}
                            </td>
                            <td className="quotation-budget-total-col py-1 md:py-1.5 text-right tabular-nums">
                              {formatQuotationMoney(row.total, currency)}
                            </td>
                          </tr>
                        );
                      }
                      if (!lineState) return null;
                      return (
                        <DraggableLineRow
                          key={lineState.dragKey}
                          dragKey={lineState.dragKey}
                          currency={currency}
                          total={row.total}
                          onRemove={() => removeLine(index)}
                        >
                          <LineRowCells
                            line={lineState}
                            index={index}
                            phaseOptions={phaseOptions}
                            onPatch={updateLine}
                            t={t}
                          />
                        </DraggableLineRow>
                      );
                    })}
                  </tbody>
                </table>
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeLine && activeLineIndex >= 0 ? (
                  <table className="w-full min-w-[720px] text-xs md:text-sm bg-[var(--tb-surface)] shadow-lg border border-[var(--tb-border)]">
                    <tbody>
                      <tr>
                        <td className="py-1 px-1 w-8">
                          <GripVerticalStub />
                        </td>
                        <td className="py-1 px-2 text-xs tb-muted truncate max-w-[8rem]">
                          {activeLine.label || t('quotations.colItem')}
                        </td>
                        <td colSpan={4} />
                        <td className="py-1 px-2 text-right tabular-nums text-xs">
                          {formatQuotationMoney(activeComputed?.total, currency)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
              </DragOverlay>
            </DndContext>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function GripVerticalStub() {
  return (
    <span className="inline-flex p-1 tb-muted">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </span>
  );
}

