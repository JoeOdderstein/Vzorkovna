import { useEffect, useMemo, useState } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import {
  fetchNotifyRecipients,
  type NotifyRecipient,
} from '../../lib/installations/notifyBugReport';

interface MessageComposeNotificationRecipientsProps {
  excludedUsernames: string[];
  onExcludedUsernamesChange: (next: string[]) => void;
  disabled?: boolean;
}

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export default function MessageComposeNotificationRecipients({
  excludedUsernames,
  onExcludedUsernamesChange,
  disabled = false,
}: MessageComposeNotificationRecipientsProps) {
  const { t } = useTaskboardI18n();
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    void fetchNotifyRecipients()
      .then((list) => {
        if (!cancelled) setRecipients(list);
      })
      .catch(() => {
        if (!cancelled) setLoadError(t('messages.notifyLoadError'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const excludedSet = useMemo(
    () => new Set(excludedUsernames.map(normalizeUsername)),
    [excludedUsernames]
  );

  const selectedCount = useMemo(
    () =>
      recipients.filter((person) => !excludedSet.has(normalizeUsername(person.username))).length,
    [recipients, excludedSet]
  );

  const toggleNotify = (username: string, checked: boolean) => {
    const key = normalizeUsername(username);
    if (checked) {
      onExcludedUsernamesChange(excludedUsernames.filter((u) => normalizeUsername(u) !== key));
      return;
    }
    if (excludedSet.has(key)) return;
    onExcludedUsernamesChange([...excludedUsernames, key]);
  };

  const selectAll = () => onExcludedUsernamesChange([]);

  const clearAll = () => {
    onExcludedUsernamesChange(recipients.map((person) => normalizeUsername(person.username)));
  };

  return (
    <div className="space-y-1.5 max-w-lg">
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
        title={t('messages.notifyHint')}
      >
        <span className="tb-field-label text-xs">{t('messages.notifyLabel')}</span>
        {!loading && recipients.length > 0 ? (
          <span className="text-xs tb-muted">
            {formatMessage(t('messages.notifySelectedCountShort'), {
              count: String(selectedCount),
              total: String(recipients.length),
            })}
          </span>
        ) : null}
        {!loading && recipients.length > 0 ? (
          <span className="flex items-center gap-1.5 ml-auto text-[11px]">
            <button
              type="button"
              className="text-[var(--tb-accent)] hover:underline disabled:opacity-50"
              disabled={disabled || selectedCount === recipients.length}
              onClick={selectAll}
            >
              {t('messages.notifySelectAll')}
            </button>
            <span className="tb-muted" aria-hidden>
              ·
            </span>
            <button
              type="button"
              className="text-[var(--tb-accent)] hover:underline disabled:opacity-50"
              disabled={disabled || selectedCount === 0}
              onClick={clearAll}
            >
              {t('messages.notifyClearAll')}
            </button>
          </span>
        ) : null}
      </div>

      {loading ? <p className="text-xs tb-muted">{t('common.loading')}</p> : null}
      {loadError ? <p className="text-xs text-red-600">{loadError}</p> : null}
      {!loading && !loadError && recipients.length === 0 ? (
        <p className="text-xs tb-muted">{t('messages.notifyNoRecipients')}</p>
      ) : null}

      {!loading && recipients.length > 0 ? (
        <div
          className="rounded-md border border-[var(--tb-border)] bg-[var(--tb-surface)] p-1.5 max-h-[5.5rem] overflow-y-auto"
          aria-label={t('messages.notifyLabel')}
        >
          <ul className="flex flex-wrap gap-1">
            {recipients.map((person) => {
              const id = `message-notify-${person.username}`;
              const checked = !excludedSet.has(normalizeUsername(person.username));
              return (
                <li key={person.username}>
                  <label
                    htmlFor={id}
                    title={person.username}
                    className={`inline-flex items-center gap-1.5 max-w-full rounded px-2 py-0.5 text-xs border cursor-pointer transition-colors ${
                      checked
                        ? 'border-[var(--tb-accent)]/35 bg-[color-mix(in_srgb,var(--tb-accent)_8%,transparent)] tb-text'
                        : 'border-[var(--tb-border)] tb-muted bg-[var(--tb-bg)]'
                    } ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-[var(--tb-accent)]/50'}`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => toggleNotify(person.username, e.target.checked)}
                      className="rounded border-[var(--tb-border)] shrink-0 size-3.5"
                    />
                    <span className="truncate max-w-[9rem] sm:max-w-[11rem]">{person.board_name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
