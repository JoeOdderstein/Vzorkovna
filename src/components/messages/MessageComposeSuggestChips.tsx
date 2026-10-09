import { memo, useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import type { TaskCategory } from '../../lib/taskboard/constants';
import type { CategoryOption, Project } from '../../lib/taskboard/types';
import ProjectRestrictedIcon from '../../taskboard/components/ProjectRestrictedIcon';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { translateCategoryLabel } from '../../lib/taskboard/i18n/messages';

interface MessageComposeSuggestChipsProps {
  projects: Project[];
  projectId: string;
  category: TaskCategory;
  categories: CategoryOption[];
  loadingProjects: boolean;
  loadingCategories: boolean;
  suggesting: boolean;
  disabled?: boolean;
  onProjectIdChange: (id: string) => void;
  onCategoryChange: (value: TaskCategory) => void;
  visible: boolean;
}

function MessageComposeSuggestChips({
  projects,
  projectId,
  category,
  categories,
  loadingProjects,
  loadingCategories,
  suggesting,
  disabled = false,
  onProjectIdChange,
  onCategoryChange,
  visible,
}: MessageComposeSuggestChipsProps) {
  const { t, locale } = useTaskboardI18n();
  const [projectOpen, setProjectOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find((p) => p.id === projectId);
  const selectedCategory = categories.find((c) => c.id === category);
  const categoryLabel = selectedCategory
    ? translateCategoryLabel(locale, selectedCategory.id, selectedCategory.label)
    : translateCategoryLabel(locale, category, category);

  useEffect(() => {
    if (!projectOpen && !categoryOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
        setCategoryOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [projectOpen, categoryOpen]);

  if (!visible) return null;

  const loading = loadingProjects || loadingCategories;
  const projectLabel =
    suggesting || loadingProjects
      ? t('messages.suggestProjectLoading')
      : selectedProject
        ? selectedProject.name
        : t('messages.suggestProjectPick');

  const categoryChipLabel =
    suggesting || loadingCategories
      ? t('messages.suggestCategoryLoading')
      : selectedCategory || category
        ? categoryLabel
        : t('messages.suggestCategoryPick');

  const showCategoryChip = Boolean(projectId) || loadingCategories;

  return (
    <div ref={rootRef} className="flex flex-wrap items-center justify-end gap-2 shrink-0 max-w-full">
      <div className="relative max-w-[min(100%,14rem)]">
        <button
          type="button"
          disabled={disabled || loadingProjects || projects.length === 0}
          onClick={() => {
            setCategoryOpen(false);
            setProjectOpen((v) => !v);
          }}
          className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors max-w-full ${
            selectedProject ? 'tb-pill-selected font-medium' : 'tb-pill hover:bg-[var(--tb-surface)]'
          } disabled:opacity-50`}
          title={t('messages.suggestProjectChange')}
          aria-expanded={projectOpen}
          aria-haspopup="listbox"
        >
          {suggesting && !selectedProject ? (
            <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin opacity-70" aria-hidden />
          ) : null}
          <span className="truncate">{selectedProject ? selectedProject.name : projectLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
        </button>

        {projectOpen && projects.length > 0 ? (
          <ul
            role="listbox"
            className="absolute right-0 z-[100] mt-1 w-[min(18rem,calc(100vw-2rem))] max-h-52 overflow-y-auto rounded-lg border bg-[var(--tb-card-bg,var(--tb-surface))] shadow-lg py-1"
          >
            {projects.map((project) => {
              const isSelected = project.id === projectId;
              return (
                <li key={project.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--tb-surface)] ${
                      isSelected ? 'font-medium' : ''
                    }`}
                    onClick={() => {
                      onProjectIdChange(project.id);
                      setProjectOpen(false);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="truncate">{project.name}</span>
                      <ProjectRestrictedIcon project={project} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      {showCategoryChip ? (
        <div className="relative max-w-[min(100%,12rem)]">
          <button
            type="button"
            disabled={disabled || !projectId || loading || categories.length === 0}
            onClick={() => {
              setProjectOpen(false);
              setCategoryOpen((v) => !v);
            }}
            className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors max-w-full ${
              selectedCategory || category
                ? 'tb-pill-selected font-medium'
                : 'tb-pill hover:bg-[var(--tb-surface)]'
            } disabled:opacity-50`}
            title={t('messages.suggestCategoryChange')}
            aria-expanded={categoryOpen}
            aria-haspopup="listbox"
          >
            {suggesting && projectId && !selectedCategory ? (
              <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin opacity-70" aria-hidden />
            ) : null}
            <span className="truncate">{categoryChipLabel}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
          </button>

          {categoryOpen && categories.length > 0 ? (
            <ul
              role="listbox"
              className="absolute right-0 z-[100] mt-1 w-[min(16rem,calc(100vw-2rem))] max-h-52 overflow-y-auto rounded-lg border bg-[var(--tb-card-bg,var(--tb-surface))] shadow-lg py-1"
            >
              {categories.map((item) => {
                const isSelected = item.id === category;
                const label = translateCategoryLabel(locale, item.id, item.label);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--tb-surface)] ${
                        isSelected ? 'font-medium' : ''
                      }`}
                      onClick={() => {
                        onCategoryChange(item.id as TaskCategory);
                        setCategoryOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default memo(MessageComposeSuggestChips);
