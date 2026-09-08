import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Task } from '../../lib/taskboard/types';
import type { Priority, TaskCategory } from '../../lib/taskboard/constants';
import { ASSIGNEES, PRIORITIES, TASK_CATEGORIES } from '../../lib/taskboard/constants';
import { toggleAssignee } from '../../lib/taskboard/assigneeUtils';
import {
  getAttachmentUrl,
  updateTask,
  uploadAttachment,
} from '../../lib/taskboard/taskService';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../../lib/taskboard/constants';
import { useTaskboardTheme } from '../../context/TaskboardThemeContext';

interface TaskDrawerProps {
  task: Task | null;
  projectId: string;
  category: TaskCategory;
  onClose: () => void;
  onSaved: () => void;
  onAddSubtask: (parentId: string) => void;
  onCategoryChange?: (taskId: string, category: TaskCategory) => Promise<void>;
  onComplete?: (taskId: string) => void;
}

export default function TaskDrawer({
  task,
  projectId: _projectId,
  category,
  onClose,
  onSaved,
  onAddSubtask,
  onCategoryChange,
  onComplete,
}: TaskDrawerProps) {
  const { theme } = useTaskboardTheme();
  const [form, setForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (task) setForm(task);
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement;
      if (target.closest('[data-task-description]')) return;

      e.preventDefault();
      if (target instanceof HTMLElement && 'blur' in target) {
        target.blur();
      }
      onClose();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!task) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (target.closest('[data-task-drawer]')) return;
      if (target.closest('[data-taskboard-interactive]')) return;
      onClose();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [task, onClose]);

  if (!task) return null;

  const save = async (updates: Partial<Task>) => {
    setSaving(true);
    setError('');
    try {
      await updateTask(task.id, updates);
      onSaved();
    } catch {
      setError('Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploadError('');
    if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) {
      setUploadError('File type not allowed.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('File is too large (max 25MB).');
      return;
    }
    try {
      const { path, name } = await uploadAttachment(file, task.id);
      await save({ attachment_path: path, attachment_name: name });
      setForm((f) => ({ ...f, attachment_path: path, attachment_name: name }));
    } catch {
      setUploadError('Upload failed.');
    }
  };

  const openAttachment = async () => {
    if (!form.attachment_path) return;
    try {
      const url = await getAttachmentUrl(form.attachment_path);
      window.open(url, '_blank');
    } catch {
      setError('Could not open attachment.');
    }
  };

  const isParent = !task.parent_task_id;

  return createPortal(
    <div
      className="taskboard tb-drawer-shell fixed inset-0 z-[70] pointer-events-none"
      data-theme={theme}
    >
      <aside
        data-task-drawer
        className="tb-drawer tb-drawer-panel overflow-y-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tb-drawer-edge" aria-hidden="true" />
        <div className="sticky top-0 tb-drawer-header px-6 py-4 flex items-center justify-between">
          <span className="tb-label">{isParent ? 'Task' : 'Subtask'}</span>
          <button onClick={onClose} className="text-[#80868b] hover:text-[#202124] transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-6">
          <Field label="Task name">
            <input
              value={form.task_name ?? ''}
              onChange={(e) => setForm({ ...form, task_name: e.target.value })}
              onBlur={() => form.task_name !== task.task_name && save({ task_name: form.task_name ?? '' })}
              className="field-input"
            />
          </Field>

          <Field label="Description">
            <textarea
              data-task-description
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => form.description !== task.description && save({ description: form.description ?? '' })}
              rows={4}
              className="field-input resize-y min-h-[100px]"
            />
          </Field>

          <Field label="Assigned to">
            <div className="flex flex-wrap gap-2">
              {ASSIGNEES.map((a) => {
                const selected = (form.assignees ?? []).includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      const next = toggleAssignee(form.assignees ?? [], a);
                      setForm({ ...form, assignees: next });
                      save({ assignees: next });
                    }}
                    className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                      selected ? 'tb-pill-selected font-medium' : 'tb-pill'
                    }`}
                  >
                    {a}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Priority">
            <select
              value={form.priority ?? 'normal'}
              onChange={(e) => {
                const val = e.target.value as Priority;
                setForm({ ...form, priority: val });
                save({ priority: val });
              }}
              className="field-input"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </Field>

          <Field label="Deadline">
            <input
              type="date"
              value={form.deadline ?? ''}
              onChange={(e) => {
                const val = e.target.value || null;
                setForm({ ...form, deadline: val });
                save({ deadline: val });
              }}
              className="field-input"
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category ?? category}
              onChange={async (e) => {
                const val = e.target.value as TaskCategory;
                setForm({ ...form, category: val });
                if (isParent && onCategoryChange) {
                  await onCategoryChange(task.id, val);
                } else {
                  save({ category: val });
                }
              }}
              className="field-input"
            >
              {TASK_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Completed">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.completed ?? false}
                onChange={(e) => {
                  const completed = e.target.checked;
                  if (completed && onComplete) {
                    onComplete(task.id);
                    onClose();
                    return;
                  }
                  setForm({ ...form, completed });
                  save({ completed });
                  if (completed) onClose();
                }}
                className="accent-[#1a73e8]"
              />
              <span className="text-sm tb-text-secondary">Mark as completed</span>
            </label>
          </Field>

          <Field label="Attachments">
            <input
              type="url"
              placeholder="Google Drive link"
              value={form.google_drive_url ?? ''}
              onChange={(e) => setForm({ ...form, google_drive_url: e.target.value })}
              onBlur={() =>
                form.google_drive_url !== task.google_drive_url &&
                save({ google_drive_url: form.google_drive_url || null })
              }
              className="field-input mb-3"
            />
            {form.google_drive_url && (
              <a
                href={form.google_drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs tb-link-accent hover:underline mb-3 truncate"
              >
                Open Google Drive link
              </a>
            )}
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = '';
              }}
              className="text-xs tb-text-secondary file:mr-3 file:bg-white file:border file:border-[#dadce0] file:text-[#5f6368] file:px-3 file:py-1.5 file:text-xs file:rounded"
            />
            {form.attachment_name && (
              <button
                type="button"
                onClick={openAttachment}
                className="mt-2 block text-xs tb-link-accent hover:underline truncate text-left"
              >
                {form.attachment_name}
              </button>
            )}
            {uploadError && <p className="mt-2 text-xs text-red-600">{uploadError}</p>}
          </Field>

          {isParent && (
            <button
              type="button"
              onClick={() => onAddSubtask(task.id)}
              className="tb-add-btn"
            >
              + Subtask
            </button>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {saving && <p className="text-xs tb-muted">Saving…</p>}
        </div>
      </aside>
    </div>,
    document.body
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="tb-field-label block mb-2">{label}</label>
      {children}
    </div>
  );
}
