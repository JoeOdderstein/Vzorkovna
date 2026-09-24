import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { TaskComment } from '../../lib/taskboard/types';
import {
  commentWasEdited,
  formatCommentTimestamp,
} from '../../lib/taskboard/commentFormat';

interface TaskCommentsSectionProps {
  taskId: string;
  comments: TaskComment[];
  loading: boolean;
  error: string;
  currentUsername: string | null;
  onPost: (body: string) => Promise<void>;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}

export default function TaskCommentsSection({
  taskId,
  comments,
  loading,
  error,
  currentUsername,
  onPost,
  onEdit,
  onDelete,
}: TaskCommentsSectionProps) {
  const [expanded, setExpanded] = useState(() => comments.length > 0);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setExpanded(comments.length > 0);
    setDraft('');
    setLocalError('');
  }, [taskId]);

  useEffect(() => {
    if (comments.length > 0) setExpanded(true);
  }, [comments.length]);

  const handlePost = async () => {
    const text = draft.trim();
    if (!text) return;
    setPosting(true);
    setLocalError('');
    try {
      await onPost(text);
      setDraft('');
    } catch {
      setLocalError('Could not post comment.');
    } finally {
      setPosting(false);
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!posting && draft.trim()) void handlePost();
    }
  };

  const displayError = localError || error;
  const countLabel = comments.length > 0 ? ` (${comments.length})` : '';

  return (
    <div className="tb-comments">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="tb-comments-toggle w-full flex items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="tb-field-label">
          Comments{countLabel}
          {loading && comments.length === 0 ? '…' : ''}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 tb-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="tb-comments-body mt-2 space-y-2">
          {comments.length > 0 ? (
            <ul className="tb-comments-list">
              {comments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  canEdit={Boolean(
                    currentUsername && currentUsername === comment.author_username
                  )}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          ) : (
            !loading && <p className="text-[11px] tb-text-muted px-0.5">No comments yet.</p>
          )}

          {currentUsername ? (
            <div className="tb-comments-composer flex gap-2 items-end">
              <textarea
                data-task-comments-composer
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                placeholder="Add a comment…"
                title="Enter to post, Shift+Enter for new line"
                className="field-input tb-comments-input flex-1 min-h-[2rem] max-h-24 resize-y py-1.5 text-sm leading-snug"
                disabled={posting}
              />
              <button
                type="button"
                onClick={handlePost}
                disabled={posting || !draft.trim()}
                className="tb-btn-primary shrink-0 text-xs px-2.5 py-1.5 disabled:opacity-50"
              >
                {posting ? '…' : 'Post'}
              </button>
            </div>
          ) : (
            <p className="text-[11px] tb-text-muted">Log in to comment.</p>
          )}

          {displayError && <p className="text-[11px] text-red-600">{displayError}</p>}
        </div>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  canEdit,
  onEdit,
  onDelete,
}: {
  comment: TaskComment;
  canEdit: boolean;
  onEdit: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState('');

  const name = comment.author_display_name.trim() || comment.author_username;
  const edited = commentWasEdited(comment);
  const time = formatCommentTimestamp(comment.created_at);

  const startEdit = () => {
    setEditBody(comment.body);
    setEditError('');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditBody(comment.body);
    setEditError('');
  };

  const saveEdit = async () => {
    const text = editBody.trim();
    if (!text) {
      setEditError('Comment cannot be empty.');
      return;
    }
    if (text === comment.body) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditError('');
    try {
      await onEdit(comment.id, text);
      setEditing(false);
    } catch {
      setEditError('Could not save comment.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting || saving) return;
    if (!window.confirm('Delete this comment?')) return;
    setDeleting(true);
    setEditError('');
    try {
      await onDelete(comment.id);
    } catch {
      setEditError('Could not delete comment.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <li className="tb-comments-item">
      {editing ? (
        <div className="space-y-1.5 py-1">
          <textarea
            data-task-comments-composer
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={2}
            className="field-input w-full min-h-[2.5rem] max-h-24 resize-y py-1.5 text-sm leading-snug"
            disabled={saving}
          />
          {editError && <p className="text-[11px] text-red-600">{editError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdit}
              disabled={saving}
              className="tb-btn-primary text-[11px] px-2 py-1 disabled:opacity-50"
            >
              {saving ? '…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="text-[11px] tb-text-secondary hover:underline px-1 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs leading-snug tb-text whitespace-pre-wrap break-words">
            <span className="font-medium">{name}</span>
            <span className="tb-text-muted font-normal"> · {time}</span>
            {edited && <span className="tb-text-muted font-normal"> · edited</span>}
            {canEdit && (
              <>
                <span className="tb-text-muted"> · </span>
                <button
                  type="button"
                  onClick={startEdit}
                  disabled={deleting}
                  className="text-[11px] tb-link-accent hover:underline font-normal align-baseline disabled:opacity-50"
                >
                  Edit
                </button>
                <span className="tb-text-muted"> · </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[11px] text-red-600 hover:underline font-normal align-baseline disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </>
            )}
          </p>
          <p className="text-xs tb-text-secondary whitespace-pre-wrap break-words leading-snug mt-0.5 pl-0">
            {comment.body}
          </p>
          {editError && !editing && (
            <p className="text-[11px] text-red-600 mt-1">{editError}</p>
          )}
        </>
      )}
    </li>
  );
}
