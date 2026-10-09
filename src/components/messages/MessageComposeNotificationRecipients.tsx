import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const excludedSet = useMemo(
    () => new Set(excludedUsernames.map(normalizeUsername)),
    [excludedUsernames]
  );

  const closedSummary = useMemo(() => {
    if (recipients.length === 0) return t('messages.notifyNoneAvailable');
    if (excludedSet.size === 0) return t('messages.notifyAllTeam');
    const names = recipients
      .filter((person) => excludedSet.has(normalizeUsername(person.username)))
      .map((person) => person.board_name);
    if (names.length === 0) return t('messages.notifyAllTeam');
    return formatMessage(t('messages.notifyExceptSummary'), { names: names.join(', ') });
  }, [recipients, excludedSet, t]);

  const toggleNotify = (username: string) => {
    const key = normalizeUsername(username);
    if (excludedSet.has(key)) {
      onExcludedUsernamesChange(
        excludedUsernames.filter((u) => normalizeUsername(u) !== key)
      );
    } else {
      onExcludedUsernamesChange([...excludedUsernames, key]);
    }
  };

  return (
    <div className="space-y-1.5">
      <span className="tb-field-label text-sm block">{t('messages.notifyLabel')}</span>
      <p className="text-xs tb-muted">{t('messages.notifyHint')}</p>
      {loading ? <p className="text-sm tb-muted">{t('common.loading')}</p> : null}
      {loadError ? <p className="text-sm text-red-600">{loadError}</p> : null}
      {!loading && !loadError && recipients.length === 0 ? (
        <p className="text-sm tb-muted">{t('messages.notifyNoRecipients')}</p>
      ) : null}
      {!loading && recipients.length > 0 ? (
        <div ref={rootRef} className="relative max-w-md">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="field-input w-full flex items-center justify-between gap-2 text-left text-sm min-h-[2.5rem] disabled:opacity-50"
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="truncate">{closedSummary}</span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {open ? (
            <ul
              role="listbox"
              aria-multiselectable="true"
              className="absolute left-0 right-0 z-[100] mt-1 max-h-52 overflow-y-auto rounded-lg border border-[var(--tb-border)] bg-[var(--tb-card-bg,var(--tb-surface))] shadow-lg py-1"
            >
              {recipients.map((person) => {
                const notify = !excludedSet.has(normalizeUsername(person.username));
                return (
                  <li key={person.username} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={notify}
                      className="w-full flex items-start gap-2.5 px-3 py-2 text-sm text-left hover:bg-[var(--tb-surface)]"
                      onClick={() => toggleNotify(person.username)}
                    >
                      <input
                        type="checkbox"
                        readOnly
                        checked={notify}
                        className="mt-0.5 rounded border-[var(--tb-border)] pointer-events-none"
                        tabIndex={-1}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate">{person.board_name}</span>
                        <span className="block text-xs tb-muted truncate">{person.email}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
