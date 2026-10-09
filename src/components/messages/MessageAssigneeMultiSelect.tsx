import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Assignee } from '../../lib/taskboard/constants';
import { toggleAssignee } from '../../lib/taskboard/assigneeUtils';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import type { TaskboardAssigneeOption } from './MessageActionPointFields';

interface MessageAssigneeMultiSelectProps {
  assigneeOptions: TaskboardAssigneeOption[];
  assignees: Assignee[];
  onAssigneesChange: (next: Assignee[]) => void;
  disabled?: boolean;
  listboxId?: string;
}

export default function MessageAssigneeMultiSelect({
  assigneeOptions,
  assignees,
  onAssigneesChange,
  disabled = false,
  listboxId = 'messages-assignee-listbox',
}: MessageAssigneeMultiSelectProps) {
  const { t } = useTaskboardI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const closedSummary = useMemo(() => {
    if (assignees.length === 0) return t('messages.assigneePick');
    const labels = assignees.map((value) => {
      const option = assigneeOptions.find((o) => o.assigneeLabel === value);
      return option?.displayLabel ?? value;
    });
    return labels.join(', ');
  }, [assignees, assigneeOptions, t]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={`${listboxId}-trigger`}
        disabled={disabled || assigneeOptions.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="field-input w-full flex items-center justify-between gap-2 text-left text-sm min-h-[2.5rem] disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
      >
        <span className={`truncate ${assignees.length === 0 ? 'tb-muted' : ''}`}>
          {closedSummary}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && assigneeOptions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          aria-labelledby={`${listboxId}-trigger`}
          className="absolute left-0 right-0 z-[100] mt-1 max-h-52 overflow-y-auto rounded-lg border border-[var(--tb-border)] bg-[var(--tb-card-bg,var(--tb-surface))] shadow-lg py-1"
        >
          {assigneeOptions.map((option) => {
            const selected = assignees.includes(option.assigneeLabel);
            return (
              <li key={option.username} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--tb-surface)]"
                  onClick={() =>
                    onAssigneesChange(toggleAssignee(assignees, option.assigneeLabel))
                  }
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? 'border-[var(--tb-accent)] bg-[var(--tb-accent)] text-white'
                        : 'border-[var(--tb-border)] bg-[var(--tb-bg)]'
                    }`}
                    aria-hidden
                  >
                    {selected ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="truncate">{option.displayLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
