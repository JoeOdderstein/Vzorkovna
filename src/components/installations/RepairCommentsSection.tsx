import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  createRepairComment,
  fetchRepairComments,
} from '../../lib/installations/repairCommentService';
import type { InstallationRepairComment } from '../../lib/installations/types';
import TranslatableText from '../../taskboard/components/TranslatableText';

interface RepairCommentsSectionProps {
  repairId: string;
}

export default function RepairCommentsSection({ repairId }: RepairCommentsSectionProps) {
  const { t } = useTaskboardI18n();
  const { username, authenticated } = useTaskboardAuth();
  const { profile } = useUserProfile();
  const [comments, setComments] = useState<InstallationRepairComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchRepairComments(repairId);
      setComments(rows);
      setError('');
    } catch {
      setError(t('projects.bug.commentsLoadError'));
    } finally {
      setLoading(false);
    }
  }, [repairId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onUpdated = () => void load();
    window.addEventListener('installations-updated', onUpdated);
    return () => window.removeEventListener('installations-updated', onUpdated);
  }, [load]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username) return;
    setSubmitting(true);
    setError('');
    try {
      const displayName = profile?.board_name?.trim() || username;
      await createRepairComment(repairId, body, {
        username,
        displayName,
      });
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.bug.commentError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-[var(--tb-border)]">
      <h3 className="text-xs tb-label mb-3">{t('projects.bug.commentsHeading')}</h3>

      {loading ? <p className="text-xs tb-muted">{t('common.loading')}</p> : null}

      {!loading && comments.length === 0 ? (
        <p className="text-xs tb-muted mb-3">{t('projects.bug.commentsEmpty')}</p>
      ) : (
        <ul className="space-y-3 mb-4">
          {comments.map((comment) => (
            <li key={comment.id} className="text-sm">
              <p className="text-xs tb-muted mb-1">
                {comment.author_display_name || comment.author_username}
              </p>
              <TranslatableText text={comment.body} multiline className="tb-text-secondary" />
            </li>
          ))}
        </ul>
      )}

      {authenticated ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder={t('projects.bug.commentPlaceholder')}
            className="field-input w-full text-sm"
          />
          {error ? <p className="text-xs text-red-500">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || !body.trim()}
            className="tb-btn-secondary text-xs disabled:opacity-50"
          >
            {submitting ? t('comments.saving') : t('comments.post')}
          </button>
        </form>
      ) : (
        <p className="text-xs tb-muted">{t('comments.logIn')}</p>
      )}
    </div>
  );
}
