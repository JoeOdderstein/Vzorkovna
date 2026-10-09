import { useMemo } from 'react';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import CategorySelect from '../../taskboard/components/CategorySelect';
import ProjectRestrictedIcon from '../../taskboard/components/ProjectRestrictedIcon';
import TranslatableText from '../../taskboard/components/TranslatableText';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { translateCategoryLabel } from '../../lib/taskboard/i18n/messages';
import {
  createProjectCategory,
  deleteProjectCategory,
  fetchCategoriesForProject,
  refreshCategoriesForProject,
} from '../../lib/taskboard/categoryService';

interface MessageProjectCategoryFieldsProps {
  projects: Project[];
  loadingProjects: boolean;
  projectId: string;
  onProjectIdChange: (id: string) => void;
  category: TaskCategory;
  onCategoryChange: (value: TaskCategory) => void;
  categories: CategoryOption[];
  loadingCategories: boolean;
  onCategoriesChange: (next: CategoryOption[]) => void;
  isAdmin: boolean;
  disabled?: boolean;
  categorySelectId?: string;
  projectHint?: string;
  hideProjectPicker?: boolean;
  hideCategoryPicker?: boolean;
}

export default function MessageProjectCategoryFields({
  projects,
  loadingProjects,
  projectId,
  onProjectIdChange,
  category,
  onCategoryChange,
  categories,
  loadingCategories,
  onCategoriesChange,
  isAdmin,
  disabled = false,
  categorySelectId = 'messages-project-category',
  projectHint,
  hideProjectPicker = false,
  hideCategoryPicker = false,
}: MessageProjectCategoryFieldsProps) {
  const { t, locale } = useTaskboardI18n();

  const localizedCategories = useMemo(
    () =>
      categories.map((item) => ({
        ...item,
        label: translateCategoryLabel(locale, item.id, item.label),
      })),
    [categories, locale]
  );

  return (
    <div className="space-y-5">
      {!hideProjectPicker ? (
        <div>
          <p className="tb-field-label mb-2">{t('addTask.chooseProject')}</p>
          {projectHint ? <p className="text-xs tb-muted mb-3">{projectHint}</p> : null}
          {loadingProjects ? (
            <p className="text-sm tb-muted">{t('addTask.loadingProjects')}</p>
          ) : null}
          {!loadingProjects && projects.length === 0 ? (
            <p className="text-sm text-red-600">{t('addTask.noProjects')}</p>
          ) : null}
          {!loadingProjects && projects.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {projects.map((project) => {
                const selected = projectId === project.id;
                return (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => onProjectIdChange(project.id)}
                      disabled={disabled}
                      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                        selected
                          ? 'tb-pill-selected font-medium'
                          : 'tb-pill hover:bg-[var(--tb-surface)]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <TranslatableText text={project.name} />
                        <ProjectRestrictedIcon project={project} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!hideCategoryPicker ? (
        <div>
          <label htmlFor={categorySelectId} className="tb-field-label block mb-2">
            {t('addTask.chooseCategory')}
          </label>
          {loadingCategories ? (
            <p className="text-sm tb-muted">{t('addTask.loadingCategories')}</p>
          ) : (
            <CategorySelect
              id={categorySelectId}
              categories={localizedCategories}
              value={category}
              onChange={onCategoryChange}
              className="field-input w-full"
              isAdmin={isAdmin}
              onAddCategory={
                isAdmin && projectId
                  ? async (label) => {
                      const created = await createProjectCategory(projectId, label);
                      const next = await refreshCategoriesForProject(projectId, created);
                      onCategoriesChange(next);
                      return created.slug;
                    }
                  : undefined
              }
              onRemoveCategory={
                isAdmin && projectId
                  ? async (categoryId) => {
                      await deleteProjectCategory(projectId, categoryId);
                      onCategoriesChange(await fetchCategoriesForProject(projectId));
                    }
                  : undefined
              }
            />
          )}
        </div>
      ) : null}
      {hideProjectPicker && hideCategoryPicker && projectHint ? (
        <p className="text-xs tb-muted">{projectHint}</p>
      ) : null}
    </div>
  );
}
