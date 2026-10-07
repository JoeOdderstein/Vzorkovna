import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  createRepairComment,
  fetchRepairComments,
} from '../../lib/installations/repairCommentService';
import { notifyRepairComment } from '../../lib/installations/notifyRepairComment';
import type { InstallationRepairComment } from '../../lib/installations/types';
import TranslatableText from '../../taskboard/components/TranslatableText';

interface RepairCommentsSectionProps {
  repairId: string;
  installationId: string;
  compact?: boolean;
}

export default function RepairCommentsSection({
  repairId,
  installationId,
  compact = false,
}: RepairCommentsSectionProps) {
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
      const comment = await createRepairComment(repairId, body, {
        username,
        displayName,
      });
      notifyRepairComment({
        repairId,
        commentId: comment.id,
        installationId,
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
    <div
      className={
        compact
          ? 'mt-2 pt-2 border-t border-[var(--tb-border)]'
          : 'mt-4 pt-4 border-t border-[var(--tb-border)]'
      }
    >
      <h3 className={`text-xs tb-label ${compact ? 'mb-1.5' : 'mb-3'}`}>
        {t('projects.bug.commentsHeading')}
      </h3>

      {loading ? <p className="text-xs tb-muted">{t('common.loading')}</p> : null}

      {!loading && comments.length === 0 ? (
        <p className={`text-xs tb-muted ${compact ? 'mb-1.5' : 'mb-3'}`}>
          {t('projects.bug.commentsEmpty')}
        </p>
      ) : (
        <ul className={`${compact ? 'space-y-2 mb-2' : 'space-y-3 mb-4'}`}>
          {comments.map((comment) => (
            <li key={comment.id} className={compact ? 'text-xs' : 'text-sm'}>
              <p className="text-[11px] tb-muted mb-0.5">
                {comment.author_display_name || comment.author_username}
              </p>
              <TranslatableText
                text={comment.body}
                multiline
                className={`tb-text-secondary ${compact ? 'text-xs leading-snug' : ''}`}
              />
            </li>
          ))}
        </ul>
      )}

      {authenticated ? (
        <form
          onSubmit={handleSubmit}
          className={compact ? 'flex flex-col gap-1.5 sm:flex-row sm:items-end' : 'space-y-2'}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={compact ? 1 : 2}
            placeholder={t('projects.bug.commentPlaceholder')}
            className={`field-input w-full ${compact ? 'text-xs py-1.5 min-h-[2.25rem] sm:flex-1' : 'text-sm'}`}
          />
          <div className={compact ? 'flex items-center gap-2 sm:flex-col sm:items-stretch' : undefined}>
            {error ? <p className="text-xs text-red-500">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting || !body.trim()}
              className={`tb-btn-secondary disabled:opacity-50 ${
                compact ? 'text-[11px] py-1 px-2.5 shrink-0' : 'text-xs'
              }`}
            >
              {submitting ? t('comments.saving') : t('comments.post')}
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs tb-muted">{t('comments.logIn')}</p>
      )}
    </div>
  );
}
