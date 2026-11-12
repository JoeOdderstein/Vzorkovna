import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import type { MessageKey } from '../../lib/taskboard/i18n/messages';
import { formatQuotationMoney } from '../../lib/quotations/quotationBudgetCalc';
import type { QuotationLineWithDragKey } from '../../lib/quotations/quotationLineDrag';

export function SectionDropRow({
  sectionIndex,
  canMoveUp,
  canMoveDown,
  canRemove,
  onMoveUp,
  onMoveDown,
  onRemove,
  children,
}: {
  sectionIndex: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { t } = useTaskboardI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: `section-${sectionIndex}`,
  });

  return (
    <tr
      ref={setNodeRef}
      className={`quotation-budget-section-row bg-[color-mix(in_srgb,var(--tb-text)_5%,var(--tb-surface))] ${
        isOver ? 'ring-2 ring-inset ring-[var(--tb-accent)]' : ''
      }`}
    >
      <td className="py-0.5 md:py-1 pr-0.5 md:pr-1 align-top w-7 lg:w-8">
        <div className="flex flex-col items-center gap-0.5">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            className="p-0.5 rounded tb-muted hover:tb-text disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('quotations.moveSectionUp')}
          >
            <ChevronUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            className="p-0.5 rounded tb-muted hover:tb-text disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('quotations.moveSectionDown')}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>
      </td>
      {children}
      <td className="quotation-budget-total-col quotation-budget-total-col--section py-0.5 md:py-1 align-top">
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            className="p-1 rounded tb-muted hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t('quotations.removeSection')}
            title={canRemove ? undefined : t('quotations.cannotRemoveLastSection')}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

export function DraggableLineRow({
  dragKey,
  currency,
  total,
  onRemove,
  children,
}: {
  dragKey: string;
  currency: string;
  total: number | null | undefined;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { t } = useTaskboardI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dragKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`quotation-budget-line-row border-b border-[var(--tb-border)]/60 ${isDragging ? 'bg-[var(--tb-surface)]' : ''}`}
    >
      <td className="py-0.5 md:py-1 pr-0.5 md:pr-1 align-top w-7 lg:w-8">
        <button
          type="button"
          className="p-1 rounded tb-muted hover:tb-text cursor-grab active:cursor-grabbing touch-none"
          aria-label={t('quotations.dragRow')}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
      </td>
      {children}
      <td className="quotation-budget-total-col py-0.5 md:py-1 align-top w-[4.5rem] lg:w-32">
        <div className="flex items-start justify-end gap-1">
          <span className="tabular-nums text-right flex-1 pt-1.5">{formatQuotationMoney(total, currency)}</span>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded tb-muted hover:text-red-600 shrink-0"
            aria-label={t('quotations.removeLine')}
          >
            <Trash2 size={15} aria-hidden />
          </button>
        </div>
      </td>
    </tr>
  );
}

export type LineRowEditorProps = {
  line: QuotationLineWithDragKey;
  index: number;
  phaseOptions: { id: string; label: string }[];
  onPatch: (index: number, patch: Partial<QuotationLineWithDragKey>) => void;
  t: (key: MessageKey, vars?: Record<string, string>) => string;
  readOnly?: boolean;
};

export function LineRowCells({ line, index, phaseOptions, onPatch, t, readOnly = false }: LineRowEditorProps) {
  const phaseLabel =
    phaseOptions.find((opt) => opt.id === line.timeline_entry_id)?.label ?? t('quotations.phaseNone');

  if (readOnly) {
    return (
      <>
        <td className="quotation-budget-phase-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-28 lg:w-44 text-xs tb-muted">
          {phaseLabel}
        </td>
        <td className="py-0.5 md:py-1 pr-1 md:pr-2 align-top text-xs min-w-[5rem]">{line.label ?? ''}</td>
        <td className="py-0.5 md:py-1 pr-1 md:pr-2 align-top w-[18%] lg:w-[28%] text-xs tb-muted">{line.notes ?? ''}</td>
        <td className="quotation-budget-unit-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-16 lg:w-24 text-xs text-right tabular-nums">
          {line.unit_price ?? ''}
        </td>
        <td className="quotation-budget-qty-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-14 lg:w-20 text-xs text-right tabular-nums">
          {line.quantity ?? ''}
        </td>
      </>
    );
  }

  return (
    <>
      <td className="quotation-budget-phase-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-28 lg:w-44">
        <select
          value={line.timeline_entry_id ?? ''}
          onChange={(e) =>
            onPatch(index, {
              timeline_entry_id: e.target.value || null,
            })
          }
          className="field-input text-xs w-full"
        >
          <option value="">{t('quotations.phaseNone')}</option>
          {phaseOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>
      <td className="py-0.5 md:py-1 pr-1 md:pr-2 align-top min-w-[5rem]">
        <input
          value={line.label ?? ''}
          onChange={(e) => onPatch(index, { label: e.target.value })}
          className="field-input text-xs w-full"
        />
      </td>
      <td className="py-0.5 md:py-1 pr-1 md:pr-2 align-top w-[18%] lg:w-[28%]">
        <input
          value={line.notes ?? ''}
          onChange={(e) => onPatch(index, { notes: e.target.value })}
          className="field-input text-xs w-full"
        />
      </td>
      <td className="quotation-budget-unit-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-16 lg:w-24">
        <input
          type="number"
          step="0.01"
          value={line.unit_price ?? ''}
          onChange={(e) =>
            onPatch(index, {
              unit_price: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="field-input text-xs w-full text-right"
        />
      </td>
      <td className="quotation-budget-qty-col py-0.5 md:py-1 pr-1 md:pr-2 align-top w-14 lg:w-20">
        <input
          type="number"
          step="0.01"
          value={line.quantity ?? ''}
          onChange={(e) =>
            onPatch(index, {
              quantity: e.target.value === '' ? null : Number(e.target.value),
            })
          }
          className="field-input text-xs w-full text-right"
        />
      </td>
    </>
  );
}
