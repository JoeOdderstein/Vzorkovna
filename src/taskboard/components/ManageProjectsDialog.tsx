import { FormEvent, useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import {
  createProject,
  deleteProject,
  fetchProjects,
  fetchTaskboardUsernames,
  isProjectVisibilityReady,
  updateProject,
} from '../../lib/taskboard/taskService';
import type { Project } from '../../lib/taskboard/types';
import ProjectVisibilityPicker, {
  selectionToVisibleTo,
  visibleToToSelection,
} from './ProjectVisibilityPicker';

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
  const [visibility, setVisibility] = useState<Record<string, string[]>>({});
  const [assignableUsers, setAssignableUsers] = useState<string[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [visibilityReady, setVisibilityReady] = useState(true);
  const [newName, setNewName] = useState('');
  const [newVisible, setNewVisible] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewName('');
    setError('');
    setLoading(true);
    setUsersLoaded(false);

    Promise.all([fetchTaskboardUsernames(), isProjectVisibilityReady()])
      .then(([{ usernames }, ready]) => {
        setVisibilityReady(ready);
        setAssignableUsers(usernames);
        setNewVisible([...usernames]);
        setUsersLoaded(true);
        return fetchProjects().then((list) => {
          setProjects(list);
          setNames(Object.fromEntries(list.map((p) => [p.id, p.name])));
          setVisibility(
            Object.fromEntries(
              list.map((p) => [p.id, visibleToToSelection(p.visible_to, usernames)])
            )
          );
        });
      })
      .catch(() => {
        setError('Could not load user list. Restart the dev server or redeploy, then try again.');
      })
      .finally(() => setLoading(false));
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

  const saveProject = async (project: Project) => {
    const trimmed = (names[project.id] ?? '').trim();
    if (!trimmed) {
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setError('Project name cannot be empty.');
      return;
    }

    const nextVisible = selectionToVisibleTo(
      visibility[project.id] ?? visibleToToSelection(project.visible_to, assignableUsers),
      assignableUsers
    );
    const nameChanged = trimmed !== project.name;
    const visibleChanged =
      JSON.stringify(nextVisible ?? null) !== JSON.stringify(project.visible_to ?? null);

    if (!nameChanged && !visibleChanged) return;

    setSavingId(project.id);
    setError('');
    try {
      const updated = await updateProject(project.id, {
        ...(nameChanged ? { name: trimmed } : {}),
        ...(visibleChanged ? { visible_to: nextVisible } : {}),
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setNames((prev) => ({ ...prev, [updated.id]: updated.name }));
      setVisibility((prev) => ({
        ...prev,
        [updated.id]: visibleToToSelection(updated.visible_to, assignableUsers),
      }));
      onChanged();
    } catch {
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setVisibility((prev) => ({
        ...prev,
        [project.id]: visibleToToSelection(project.visible_to, assignableUsers),
      }));
      setError('Could not update project.');
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
      setVisibility((prev) => {
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
    if (!usersLoaded || assignableUsers.length === 0) {
      setError('User list is still loading. Wait a moment and try again.');
      return;
    }

    setAdding(true);
    setError('');
    try {
      const visible_to = selectionToVisibleTo(newVisible, assignableUsers);
      const project = await createProject(trimmed, visible_to);
      setProjects((prev) => [...prev, project]);
      setNames((prev) => ({ ...prev, [project.id]: project.name }));
      setVisibility((prev) => ({
        ...prev,
        [project.id]: visibleToToSelection(project.visible_to, assignableUsers),
      }));
      setNewName('');
      setNewVisible([...assignableUsers]);
      onChanged();
      onProjectCreated?.(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project. That name may already exist.');
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
          {!visibilityReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Project visibility is not set up yet. In Supabase → SQL Editor, run{' '}
              <code className="text-xs">supabase/migrations/005_project_visibility.sql</code>, then
              add the project again.
            </p>
          )}
          <div>
            <p className="tb-field-label mb-3">Projects</p>
            {loading && <p className="text-sm tb-muted">Loading projects…</p>}
            {!loading && projects.length === 0 && (
              <p className="text-sm tb-muted">No projects yet. Add one below.</p>
            )}
            {!loading && projects.length > 0 && (
              <ul className="space-y-4">
                {projects.map((project) => (
                  <li key={project.id} className="space-y-3 pb-4 border-b border-[#eceff1] last:border-0">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={names[project.id] ?? project.name}
                        onChange={(e) =>
                          setNames((prev) => ({ ...prev, [project.id]: e.target.value }))
                        }
                        onBlur={() => saveProject(project)}
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
                    </div>
                    <ProjectVisibilityPicker
                      usernames={assignableUsers}
                      selected={
                        visibility[project.id] ??
                        visibleToToSelection(project.visible_to, assignableUsers)
                      }
                      onChange={(selected) => {
                        setVisibility((prev) => ({ ...prev, [project.id]: selected }));
                      }}
                      disabled={savingId === project.id || deletingId === project.id}
                    />
                    <button
                      type="button"
                      onClick={() => saveProject(project)}
                      disabled={savingId === project.id || deletingId === project.id}
                      className="text-xs tb-link uppercase tracking-[0.15em]"
                    >
                      {savingId === project.id ? 'Saving…' : 'Save visibility'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleAdd} className="space-y-4">
            <p className="tb-field-label">Add project</p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Mirror Room"
              className="field-input w-full"
            />
            <ProjectVisibilityPicker
              usernames={assignableUsers}
              selected={newVisible}
              onChange={setNewVisible}
              disabled={adding}
            />
            <button
              type="submit"
              disabled={adding || !newName.trim() || !usersLoaded || !visibilityReady}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
            >
              {adding ? 'Adding…' : 'Add project'}
            </button>
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
