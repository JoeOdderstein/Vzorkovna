import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TaskCategory } from '../../lib/taskboard/constants';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { fetchVisibleProjects } from '../../lib/taskboard/taskService';
import {
  createProjectCategory,
  deleteProjectCategory,
  fetchCategoriesForProject,
  refreshCategoriesForProject,
} from '../../lib/taskboard/categoryService';
import { DEFAULT_CATEGORIES } from '../../lib/taskboard/categoryUtils';
import ProjectRestrictedIcon from './ProjectRestrictedIcon';
import CategorySelect from './CategorySelect';
import type { CategoryOption } from '../../lib/taskboard/types';
import type { Project } from '../../lib/taskboard/types';

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { category: TaskCategory; projectId: string }) => Promise<void>;
  defaultProjectId?: string;
}

export default function AddTaskDialog({
  open,
  onClose,
  onCreate,
  defaultProjectId,
}: AddTaskDialogProps) {
  const { username, isAdmin } = useTaskboardAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [category, setCategory] = useState<TaskCategory>('quotations');
  const [categories, setCategories] = useState<CategoryOption[]>(DEFAULT_CATEGORIES);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;

    setCategory('quotations');
    setError('');
    setSubmitting(false);
    setLoadingProjects(true);

    fetchVisibleProjects(username, isAdmin)
      .then((list) => {
        setProjects(list);
        const preferred = defaultProjectId && list.some((p) => p.id === defaultProjectId)
          ? defaultProjectId
          : list[0]?.id ?? '';
        setProjectId(preferred);
        if (list.length === 0) {
          setError(
            'No projects in the database. Run supabase/migrations/001_taskboard.sql in your Supabase SQL editor.'
          );
        }
      })
      .catch((err) => {
        setProjects([]);
        setProjectId('');
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load projects. Check that you are logged in and Supabase is connected.'
        );
      })
      .finally(() => setLoadingProjects(false));
  }, [open, defaultProjectId, username, isAdmin]);

  useEffect(() => {
    if (!open || !projectId) return;

    setLoadingCategories(true);
    fetchCategoriesForProject(projectId)
      .then((list) => {
        setCategories(list);
        setCategory((current) => (list.some((item) => item.id === current) ? current : list[0]?.id ?? 'quotations'));
      })
      .catch(() => setCategories(DEFAULT_CATEGORIES))
      .finally(() => setLoadingCategories(false));
  }, [open, projectId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('Choose a project.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate({ category, projectId });
      onClose();
    } catch {
      setError('Could not create task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white border border-[#dadce0] rounded-lg shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#dadce0] px-6 py-4 flex items-center justify-between">
          <h2 className="tb-heading">New task</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          <div>
            <p className="tb-field-label mb-3">1. Choose project</p>
            {loadingProjects && <p className="text-sm tb-muted">Loading projects…</p>}
            {!loadingProjects && projects.length === 0 && (
              <p className="text-sm text-red-600">No projects found.</p>
            )}
            {!loadingProjects && projects.length > 0 && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {projects.map((p) => {
                  const selected = projectId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setProjectId(p.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                          selected ? 'tb-pill-selected font-medium' : 'tb-pill hover:bg-[var(--tb-surface)]'
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <span>{p.name}</span>
                          <ProjectRestrictedIcon project={p} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="new-task-category" className="tb-field-label block mb-2">
              2. Choose category
            </label>
            {loadingCategories ? (
              <p className="text-sm tb-muted">Loading categories…</p>
            ) : (
              <CategorySelect
                id="new-task-category"
                categories={categories}
                value={category}
                onChange={setCategory}
                isAdmin={isAdmin}
                onAddCategory={
                  isAdmin && projectId
                    ? async (label) => {
                        const created = await createProjectCategory(projectId, label);
                        const next = await refreshCategoriesForProject(projectId, created);
                        setCategories(next);
                        return created.slug;
                      }
                    : undefined
                }
                onRemoveCategory={
                  isAdmin && projectId
                    ? async (categoryId) => {
                        await deleteProjectCategory(projectId, categoryId);
                        setCategories(await fetchCategoriesForProject(projectId));
                      }
                    : undefined
                }
              />
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="tb-link px-3 py-2">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingProjects || !projectId}
              className="px-4 py-2 text-sm font-medium text-white tb-btn-primary rounded disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Creating…' : 'Create task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
