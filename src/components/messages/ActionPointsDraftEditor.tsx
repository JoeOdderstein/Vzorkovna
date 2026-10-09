import { Trash2 } from 'lucide-react';
import type { ActionPointDraft } from '../../lib/messages/types';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import type { TaskboardAssigneeOption } from './MessageActionPointFields';
import MessageActionCategoryOverride from './MessageActionCategoryOverride';
import MessageAssigneeMultiSelect from './MessageAssigneeMultiSelect';

interface ActionPointsDraftEditorProps {
  drafts: ActionPointDraft[];
  onChange: (next: ActionPointDraft[]) => void;
  projects: Project[];
  messageProjectId: string;
  messageCategory: TaskCategory;
  messageCategories: CategoryOption[];
  isAdmin: boolean;
  assigneeOptions: TaskboardAssigneeOption[];
  disabled?: boolean;
  fromAiSuggest?: boolean;
}

export default function ActionPointsDraftEditor({
  drafts,
  onChange,
  projects,
  messageProjectId,
  messageCategory,
  messageCategories,
  isAdmin,
  assigneeOptions,
  disabled = false,
  fromAiSuggest = false,
}: ActionPointsDraftEditorProps) {
  const { t } = useTaskboardI18n();

  const updateDraft = (draftId: string, patch: Partial<ActionPointDraft>) => {
    onChange(drafts.map((d) => (d.draftId === draftId ? { ...d, ...patch } : d)));
  };

  const removeDraft = (draftId: string) => {
    onChange(drafts.filter((d) => d.draftId !== draftId));
  };

  const addBlank = () => {
    onChange([
      ...drafts,
      {
        draftId: crypto.randomUUID(),
        enabled: true,
        taskName: '',
        projectId: messageProjectId,
        category: messageCategory,
        assignees: [],
      },
    ]);
  };

  if (drafts.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {fromAiSuggest ? t('messages.aiPreviewTitle') : t('messages.actionPointsTitle')}
        </p>
        <button
          type="button"
          className="tb-link text-sm"
          onClick={addBlank}
          disabled={disabled || projects.length === 0}
        >
          {t('messages.actionPointsAdd')}
        </button>
      </div>
      <p className="text-xs tb-muted">
        {fromAiSuggest ? t('messages.aiPreviewHint') : t('messages.actionPointsHint')}
      </p>

      <ul className="space-y-4">
        {drafts.map((draft, index) => (
          <li
            key={draft.draftId}
            className={`rounded-lg border p-4 space-y-3 ${
              draft.enabled
                ? 'border-[var(--tb-border)]'
                : 'border-dashed opacity-60 border-[var(--tb-border)]'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) => updateDraft(draft.draftId, { enabled: e.target.checked })}
                disabled={disabled}
                className="mt-1 rounded border-[var(--tb-border)]"
                aria-label={formatMessage(t('messages.aiIncludeTask'), {
                  n: String(index + 1),
                })}
              />
              <div className="flex-1 min-w-0 space-y-3">
                <input
                  type="text"
                  value={draft.taskName}
                  onChange={(e) => updateDraft(draft.draftId, { taskName: e.target.value })}
                  className="field-input w-full"
                  placeholder={t('messages.actionTitlePlaceholder')}
                  disabled={disabled || !draft.enabled}
                />

                <MessageActionCategoryOverride
                  projects={projects}
                  messageProjectId={messageProjectId}
                  messageCategory={messageCategory}
                  categories={messageCategories}
                  categoryOverride={draft.categoryOverride}
                  onCategoryOverrideChange={(value) =>
                    updateDraft(draft.draftId, {
                      categoryOverride: value,
                      category: value ?? messageCategory,
                      projectId: messageProjectId,
                    })
                  }
                  isAdmin={isAdmin}
                  disabled={disabled || !draft.enabled}
                  categorySelectId={`draft-cat-${draft.draftId}`}
                />

                <label className="block">
                  <span className="tb-field-label text-xs mb-1 block">{t('task.assignedTo')}</span>
                  <MessageAssigneeMultiSelect
                    assigneeOptions={assigneeOptions}
                    assignees={draft.assignees}
                    onAssigneesChange={(next) =>
                      updateDraft(draft.draftId, { assignees: next })
                    }
                    disabled={disabled || !draft.enabled}
                    listboxId={`draft-assignee-${draft.draftId}`}
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeDraft(draft.draftId)}
                disabled={disabled}
                className="text-[var(--tb-text-muted)] hover:text-red-600 p-1"
                aria-label={t('messages.aiRemoveRow')}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
