import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CategoryOption } from '../../lib/taskboard/types';

interface CategorySelectProps {
  id: string;
  categories: CategoryOption[];
  value: string;
  onChange: (value: string) => void;
  isAdmin?: boolean;
  onAddCategory?: (label: string) => Promise<string | void>;
  onRemoveCategory?: (categoryId: string) => Promise<void>;
  className?: string;
}

export default function CategorySelect({
  id,
  categories,
  value,
  onChange,
  isAdmin = false,
  onAddCategory,
  onRemoveCategory,
  className = 'field-input',
}: CategorySelectProps) {
  const [managing, setManaging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const canManage = isAdmin && (onAddCategory || onRemoveCategory);
  const canRemoveAny = categories.length > 1;

  const closeManager = () => {
    setManaging(false);
    setAdding(false);
    setNewLabel('');
    setError('');
  };

  const handleAdd = async () => {
    if (!onAddCategory || saving) return;

    const trimmed = newLabel.trim();
    if (!trimmed) {
      setError('Enter a category name.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const createdId = await onAddCategory(trimmed);
      setNewLabel('');
      setAdding(false);
      if (createdId) onChange(createdId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add category.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (category: CategoryOption) => {
    if (!onRemoveCategory) return;

    const confirmed = window.confirm(`Remove "${category.label}" from this project?`);
    if (!confirmed) return;

    setRemovingId(category.id);
    setError('');
    try {
      await onRemoveCategory(category.id);
      if (value === category.id) {
        const fallback = categories.find((item) => item.id !== category.id);
        if (fallback) onChange(fallback.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove category.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-2">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
      >
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.label}
          </option>
        ))}
      </select>

      {canManage && !managing && (
        <button
          type="button"
          onClick={() => setManaging(true)}
          className="text-xs tb-link"
        >
          Manage categories
        </button>
      )}

      {canManage && managing && (
        <div className="rounded-lg border border-[#eceff1] bg-[var(--tb-surface,#fafafa)] p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[0.65rem] tracking-[0.15em] uppercase tb-muted">
              Categories for this project
            </p>
            <button type="button" onClick={closeManager} className="text-xs tb-link shrink-0">
              Done
            </button>
          </div>

          {onRemoveCategory && (
            <ul className="space-y-2">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-2 text-sm tb-text"
                >
                  <span>{category.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(category)}
                    disabled={removingId === category.id || !canRemoveAny}
                    className="p-1.5 text-[#80868b] hover:text-red-600 transition-colors disabled:opacity-50"
                    aria-label={`Remove ${category.label}`}
                    title={
                      canRemoveAny
                        ? `Remove ${category.label}`
                        : 'A project needs at least one category'
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {onAddCategory && (
            <div>
              {!adding ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdding(true);
                    setError('');
                  }}
                  className="text-xs tb-link"
                >
                  + Add category
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        void handleAdd();
                      }
                    }}
                    placeholder="Category name"
                    className="field-input flex-1 min-w-0"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => void handleAdd()}
                    disabled={saving || !newLabel.trim()}
                    className="px-3 py-2 text-xs font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] disabled:opacity-50 transition-colors shrink-0"
                  >
                    {saving ? 'Adding…' : 'Add'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setNewLabel('');
                      setError('');
                    }}
                    className="text-xs tb-link shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
