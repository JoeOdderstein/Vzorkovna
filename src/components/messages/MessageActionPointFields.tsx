import { Trash2 } from 'lucide-react';
import type { Assignee, TaskCategory } from '../../lib/taskboard/constants';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import type { TaskboardMember } from '../../lib/taskboard/memberService';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import MessageActionCategoryOverride from './MessageActionCategoryOverride';
import MessageAssigneeMultiSelect from './MessageAssigneeMultiSelect';

export type TaskboardAssigneeOption = {
  username: string;
  assigneeLabel: Assignee;
  displayLabel: string;
};

export function buildAssigneeOptionsFromNames(names: Assignee[]): TaskboardAssigneeOption[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((assigneeLabel) => ({
      username: assigneeLabel.toLowerCase().replace(/\s+/g, '-'),
      assigneeLabel,
      displayLabel: assigneeLabel,
    }));
}

export function buildAssigneeOptionsFromMembers(members: TaskboardMember[]): TaskboardAssigneeOption[] {
  const byLabel = new Map<string, TaskboardAssigneeOption>();

  for (const member of members) {
    const assigneeLabel =
      member.board_name?.trim() ||
      defaultBoardNameForUsername(member.username) ||
      member.username.trim();
    if (!assigneeLabel) continue;

    const key = assigneeLabel.toLowerCase();
    if (byLabel.has(key)) continue;

    byLabel.set(key, {
      username: member.username,
      assigneeLabel,
      displayLabel: member.board_name?.trim() || assigneeLabel,
    });
  }

  return [...byLabel.values()].sort((a, b) =>
    a.displayLabel.localeCompare(b.displayLabel, undefined, { sensitivity: 'base' })
  );
}

interface MessageActionPointFieldsProps {
  actionTitle: string;
  onActionTitleChange: (value: string) => void;
  projects: Project[];
  messageProjectId: string;
  messageCategory: TaskCategory;
  messageCategories: CategoryOption[];
  categoryOverride?: TaskCategory;
  onCategoryOverrideChange: (value: TaskCategory | undefined) => void;
  assigneeOptions: TaskboardAssigneeOption[];
  loadingTeam: boolean;
  teamReady: boolean;
  assignees: Assignee[];
  onAssigneesChange: (next: Assignee[]) => void;
  isAdmin: boolean;
  disabled?: boolean;
  onRemove?: () => void;
}

export default function MessageActionPointFields({
  actionTitle,
  onActionTitleChange,
  projects,
  messageProjectId,
  messageCategory,
  messageCategories,
  categoryOverride,
  onCategoryOverrideChange,
  assigneeOptions,
  loadingTeam,
  teamReady,
  assignees,
  onAssigneesChange,
  isAdmin,
  disabled = false,
  onRemove,
}: MessageActionPointFieldsProps) {
  const { t } = useTaskboardI18n();

  return (
    <div className="relative rounded-lg border border-[var(--tb-border)] p-3 sm:p-4 pr-10 sm:pr-11 space-y-3">
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="absolute top-2.5 right-2.5 text-[var(--tb-text-muted)] hover:text-red-600 p-1 rounded-md disabled:opacity-50"
          aria-label={t('messages.removeActionPoint')}
        >
          <Trash2 size={16} aria-hidden />
        </button>
      ) : null}
      <label className="block">
        <span className="tb-field-label mb-2 block">{t('messages.actionTitle')}</span>
        <input
          type="text"
          value={actionTitle}
          onChange={(e) => onActionTitleChange(e.target.value)}
          className="field-input w-full"
          placeholder={t('messages.actionTitlePlaceholder')}
          disabled={disabled}
        />
      </label>

      <MessageActionCategoryOverride
        projects={projects}
        messageProjectId={messageProjectId}
        messageCategory={messageCategory}
        categories={messageCategories}
        categoryOverride={categoryOverride}
        onCategoryOverrideChange={onCategoryOverrideChange}
        isAdmin={isAdmin}
        disabled={disabled}
        categorySelectId="messages-action-category-override"
      />

      <label className="block">
        <span className="tb-field-label mb-1.5 block">{t('task.assignedTo')}</span>
        {loadingTeam ? <p className="text-sm tb-muted">{t('messages.loadingTeam')}</p> : null}
        {!loadingTeam && !teamReady ? (
          <p className="text-sm tb-muted">{t('messages.teamMigrationHint')}</p>
        ) : null}
        {!loadingTeam && assigneeOptions.length === 0 ? (
          <p className="text-sm tb-muted">{t('messages.noTeamMembers')}</p>
        ) : null}
        {!loadingTeam && assigneeOptions.length > 0 ? (
          <MessageAssigneeMultiSelect
            assigneeOptions={assigneeOptions}
            assignees={assignees}
            onAssigneesChange={onAssigneesChange}
            disabled={disabled}
            listboxId="messages-action-assignee-listbox"
          />
        ) : null}
      </label>
    </div>
  );
}
