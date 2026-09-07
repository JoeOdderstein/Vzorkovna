import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Task } from '../../lib/taskboard/types';
import type { Assignee, Priority, TaskCategory } from '../../lib/taskboard/constants';
import { ASSIGNEES, PRIORITIES, TASK_CATEGORIES } from '../../lib/taskboard/constants';
import {
  getAttachmentUrl,
  updateTask,
  uploadAttachment,
} from '../../lib/taskboard/taskService';
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from '../../lib/taskboard/constants';

interface TaskDrawerProps {
  task: Task | null;
  projectId: string;
  category: TaskCategory;
  onClose: () => void;
  onSaved: () => void;
  onAddSubtask: (parentId: string) => void;
  onCategoryChange?: (taskId: string, category: TaskCategory) => Promise<void>;
}

export default function TaskDrawer({
  task,
  projectId: _projectId,
  category,
  onClose,
  onSaved,
  onAddSubtask,
  onCategoryChange,
}: TaskDrawerProps) {
  const [form, setForm] = useState<Partial<Task>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (task) setForm(task);
  }, [task]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

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

  return (
    <div className="taskboard fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      <aside
        className="relative w-full max-w-md h-full tb-drawer overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
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
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              onBlur={() => form.description !== task.description && save({ description: form.description ?? '' })}
              rows={4}
              className="field-input resize-y min-h-[100px]"
            />
          </Field>

          <Field label="Assigned to">
            <select
              value={form.assigned_to ?? ''}
              onChange={(e) => {
                const val = (e.target.value || null) as Assignee | null;
                setForm({ ...form, assigned_to: val });
                save({ assigned_to: val });
              }}
              className="field-input"
            >
              <option value="">Unassigned</option>
              {ASSIGNEES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
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
    </div>
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
