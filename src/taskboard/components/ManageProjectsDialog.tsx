import { FormEvent, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  createProject,
  deleteProject,
  fetchProjects,
  updateProject,
} from '../../lib/taskboard/taskService';
import type { Project } from '../../lib/taskboard/types';

interface ManageProjectsDialogProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  onProjectCreated?: (project: Project) => void;
}

export default function ManageProjectsDialog({
  open,
  onClose,
  onChanged,
  onProjectCreated,
}: ManageProjectsDialogProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadProjects = () => {
    setLoading(true);
    setError('');
    return fetchProjects()
      .then((list) => {
        setProjects(list);
        setNames(Object.fromEntries(list.map((p) => [p.id, p.name])));
      })
      .catch(() => setError('Could not load projects.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setNewName('');
    setError('');
    loadProjects();
  }, [open]);

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

  const handleRename = async (project: Project) => {
    const trimmed = (names[project.id] ?? '').trim();
    if (!trimmed) {
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setError('Project name cannot be empty.');
      return;
    }
    if (trimmed === project.name) return;

    setSavingId(project.id);
    setError('');
    try {
      const updated = await updateProject(project.id, trimmed);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setNames((prev) => ({ ...prev, [updated.id]: updated.name }));
      onChanged();
    } catch {
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setError('Could not rename project. That name may already exist.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (project: Project) => {
    const confirmed = window.confirm(
      `Delete "${project.name}"? All tasks in this project will be permanently removed.`
    );
    if (!confirmed) return;

    setDeletingId(project.id);
    setError('');
    try {
      await deleteProject(project.id);
      setProjects((prev) => prev.filter((p) => p.id !== project.id));
      setNames((prev) => {
        const next = { ...prev };
        delete next[project.id];
        return next;
      });
      onChanged();
    } catch {
      setError('Could not delete project.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Enter a project name.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      const project = await createProject(trimmed);
      setProjects((prev) => [...prev, project]);
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setNewName('');
      onChanged();
      onProjectCreated?.(project);
    } catch {
      setError('Could not create project. That name may already exist.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      <div
        className="relative w-full max-w-lg bg-white border border-[#dadce0] rounded-lg shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#dadce0] flex items-center justify-between shrink-0">
          <h2 className="tb-heading">Manage projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-6">
          <div>
            <p className="tb-field-label mb-3">Projects</p>
            {loading && <p className="text-sm tb-muted">Loading projects…</p>}
            {!loading && projects.length === 0 && (
              <p className="text-sm tb-muted">No projects yet. Add one below.</p>
            )}
            {!loading && projects.length > 0 && (
              <ul className="space-y-2">
                {projects.map((project) => (
                  <li key={project.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={names[project.id] ?? project.name}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [project.id]: e.target.value }))
                      }
                      onBlur={() => handleRename(project)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      disabled={savingId === project.id || deletingId === project.id}
                      className="field-input flex-1 min-w-0"
                      aria-label={`Rename ${project.name}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleDelete(project)}
                      disabled={savingId === project.id || deletingId === project.id}
                      className="p-2 text-[#80868b] hover:text-red-600 transition-colors disabled:opacity-50"
                      aria-label={`Delete ${project.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleAdd} className="space-y-3">
            <p className="tb-field-label">Add project</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Mirror Room"
                className="field-input flex-1 min-w-0"
              />
              <button
                type="submit"
                disabled={adding || !newName.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] disabled:opacity-50 transition-colors shrink-0"
              >
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </form>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-[#dadce0] flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="tb-link px-3 py-2">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
