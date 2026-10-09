import { useMemo, useState } from 'react';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import CategorySelect from '../../taskboard/components/CategorySelect';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { translateCategoryLabel } from '../../lib/taskboard/i18n/messages';

interface MessageActionCategoryOverrideProps {
  projects: Project[];
  messageProjectId: string;
  messageCategory: TaskCategory;
  categories: CategoryOption[];
  categoryOverride?: TaskCategory;
  onCategoryOverrideChange: (value: TaskCategory | undefined) => void;
  isAdmin: boolean;
  disabled?: boolean;
  categorySelectId: string;
}

export default function MessageActionCategoryOverride({
  projects,
  messageProjectId,
  messageCategory,
  categories,
  categoryOverride,
  onCategoryOverrideChange,
  isAdmin,
  disabled = false,
  categorySelectId,
}: MessageActionCategoryOverrideProps) {
  const { t, locale } = useTaskboardI18n();
  const [pickerOpen, setPickerOpen] = useState(Boolean(categoryOverride));

  const projectName =
    projects.find((p) => p.id === messageProjectId)?.name ?? t('common.project');

  const effectiveCategory = categoryOverride ?? messageCategory;

  const localizedCategories = useMemo(
    () =>
      categories.map((item) => ({
        ...item,
        label: translateCategoryLabel(locale, item.id, item.label),
      })),
    [categories, locale]
  );

  const categoryLabel = translateCategoryLabel(
    locale,
    effectiveCategory,
    localizedCategories.find((c) => c.id === effectiveCategory)?.label ?? effectiveCategory
  );

  return (
    <div className="space-y-2">
      <p className="text-xs tb-muted">
        {projectName} · {categoryLabel}
      </p>
      {!pickerOpen ? (
        <button
          type="button"
          className="tb-link text-xs font-normal"
          disabled={disabled || !messageProjectId}
          onClick={() => setPickerOpen(true)}
        >
          {t('messages.changeActionCategory')}
        </button>
      ) : (
        <div className="space-y-2 max-w-md">
          <CategorySelect
            id={categorySelectId}
            categories={localizedCategories}
            value={effectiveCategory}
            onChange={(value) => {
              if (value === messageCategory) {
                onCategoryOverrideChange(undefined);
              } else {
                onCategoryOverrideChange(value);
              }
            }}
            className="field-input w-full text-sm"
            isAdmin={isAdmin}
            disabled={disabled}
          />
          {categoryOverride ? (
            <button
              type="button"
              className="tb-link text-xs font-normal"
              disabled={disabled}
              onClick={() => {
                onCategoryOverrideChange(undefined);
                setPickerOpen(false);
              }}
            >
              {t('messages.resetActionCategory')}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
