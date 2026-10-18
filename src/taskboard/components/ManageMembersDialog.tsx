import { FormEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  createMember,
  deleteMember,
  fetchMembers,
  sendMemberInvite,
  type TaskboardMember,
} from '../../lib/taskboard/memberService';
import {
  fetchMessageAccessMembers,
  grantMessageAccess,
  revokeMessageAccess,
  type MessageAccessMember,
} from '../../lib/taskboard/messageAccessService';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

interface ManageMembersDialogProps {
  open: boolean;
  onClose: () => void;
}

function statusLabel(member: TaskboardMember) {
  if (member.hasPassword && member.source !== 'env') return 'Password set';
  if (member.source === 'env' && !member.email) return 'Server login (env password)';
  if (member.source === 'env' && member.hasPassword) return 'Server login';
  if (member.invitePending) return 'Invite sent — waiting for password';
  if (!member.email && member.source !== 'env') return 'Add email to send invite';
  if (member.hasPassword) return 'Can log in';
  return 'Ready to send invite';
}

function canSendInvite(member: TaskboardMember) {
  return !member.isAdmin && !member.hasPassword && Boolean(member.email);
}

function needsEmailSetup(member: TaskboardMember) {
  return !member.isAdmin && !member.hasPassword && !member.email && member.source !== 'env';
}

function canDeleteMember(member: TaskboardMember) {
  if (member.isAdmin || member.source === 'env' || member.source === 'roster') return false;
  return true;
}

export default function ManageMembersDialog({ open, onClose }: ManageMembersDialogProps) {
  const { t } = useTaskboardI18n();
  const [members, setMembers] = useState<TaskboardMember[]>([]);
  const [membersReady, setMembersReady] = useState(true);
  const [messageAccessMembers, setMessageAccessMembers] = useState<MessageAccessMember[]>([]);
  const [messageAccessReady, setMessageAccessReady] = useState(true);
  const [messageAccessLoading, setMessageAccessLoading] = useState(false);
  const [messageAccessUsername, setMessageAccessUsername] = useState('');
  const [grantingMessageAccess, setGrantingMessageAccess] = useState(false);
  const [revokingMessageAccess, setRevokingMessageAccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [boardName, setBoardName] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastInviteUrl, setLastInviteUrl] = useState('');
  const [emailDrafts, setEmailDrafts] = useState<Record<string, string>>({});
  const [savingEmail, setSavingEmail] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const grantedMessageUsernames = useMemo(
    () => new Set(messageAccessMembers.map((member) => member.username)),
    [messageAccessMembers],
  );

  const addableMessageAccessMembers = useMemo(
    () =>
      members
        .filter((member) => !member.isAdmin && !grantedMessageUsernames.has(member.username))
        .sort((a, b) => {
          const nameA = a.board_name || a.username;
          const nameB = b.board_name || b.username;
          return nameA.localeCompare(nameB);
        }),
    [members, grantedMessageUsernames],
  );

  const load = () => {
    setLoading(true);
    setMessageAccessLoading(true);
    Promise.allSettled([fetchMembers(), fetchMessageAccessMembers()])
      .then(([rosterResult, accessResult]) => {
        if (rosterResult.status === 'fulfilled') {
          const list = rosterResult.value.members;
          setMembers(list);
          setMembersReady(rosterResult.value.membersReady);
          setEmailDrafts((prev) => {
            const next = { ...prev };
            for (const member of list) {
              if (member.email) next[member.username] = member.email;
              else if (next[member.username] === undefined) next[member.username] = '';
            }
            return next;
          });
        } else {
          setError(
            rosterResult.reason instanceof Error
              ? rosterResult.reason.message
              : 'Could not load members.',
          );
        }

        if (accessResult.status === 'fulfilled') {
          setMessageAccessMembers(accessResult.value.members);
          setMessageAccessReady(accessResult.value.messageAccessReady);
        } else {
          setMessageAccessReady(false);
          if (rosterResult.status === 'fulfilled') {
            setError(
              accessResult.reason instanceof Error
                ? accessResult.reason.message
                : 'Could not load Messages access settings.',
            );
          }
        }

        if (rosterResult.status === 'fulfilled' && accessResult.status === 'fulfilled') {
          setError('');
        }
      })
      .finally(() => {
        setLoading(false);
        setMessageAccessLoading(false);
      });
  };

  useEffect(() => {
    if (!open) return;
    setUsername('');
    setBoardName('');
    setEmail('');
    setMessageAccessUsername('');
    setNotice('');
    setLastInviteUrl('');
    setError('');
    load();
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

  const handleAdd = async (e: FormEvent, sendInvite: boolean) => {
    e.preventDefault();
    setAdding(true);
    setError('');
    setNotice('');
    try {
      const member = await createMember({
        username,
        board_name: boardName,
        email,
      });
      setMembers((prev) => {
        const without = prev.filter((item) => item.username !== member.username);
        return [...without, member].sort((a, b) => a.username.localeCompare(b.username));
      });
      setUsername('');
      setBoardName('');
      setEmail('');

      if (sendInvite) {
        const result = await sendMemberInvite(member.username);
        setLastInviteUrl(result.inviteUrl);
        setNotice(
          result.emailed
            ? `Invite emailed to ${member.email}. You can also copy the link below.`
            : 'Invite created. Copy the link below (email is not configured on the server).'
        );
        load();
      } else {
        setNotice(`${member.username} added. Send an invite when you are ready.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add member.');
    } finally {
      setAdding(false);
    }
  };

  const handleSaveEmail = async (member: TaskboardMember) => {
    const email = (emailDrafts[member.username] ?? member.email ?? '').trim();
    const board_name = (member.board_name ?? member.username).trim();
    if (!email.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setSavingEmail(member.username);
    setError('');
    setNotice('');
    try {
      const saved = await createMember({
        username: member.username,
        board_name,
        email,
      });
      setMembers((prev) => {
        const without = prev.filter((item) => item.username !== saved.username);
        return [...without, saved].sort((a, b) => {
          const nameA = a.board_name || a.username;
          const nameB = b.board_name || b.username;
          return nameA.localeCompare(nameB);
        });
      });
      setEmailDrafts((prev) => ({ ...prev, [member.username]: email }));
      setNotice(`Saved email for ${board_name}. You can send an invite now.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save email.');
    } finally {
      setSavingEmail(null);
    }
  };

  const handleDelete = async (member: TaskboardMember) => {
    const label = member.board_name || member.username;
    const confirmed = window.confirm(
      `Remove login and profile for ${label} (${member.username})?\n\nThey can still appear on existing tasks as an assignee name. You can add them again later from this screen.`
    );
    if (!confirmed) return;

    setDeleting(member.username);
    setError('');
    setNotice('');
    try {
      await deleteMember(member.username);
      setMembers((prev) => prev.filter((item) => item.username !== member.username));
      setNotice(`Removed ${label}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove member.');
    } finally {
      setDeleting(null);
    }
  };

  const handleInvite = async (member: TaskboardMember) => {
    setInviting(member.username);
    setError('');
    setNotice('');
    try {
      const result = await sendMemberInvite(member.username);
      setLastInviteUrl(result.inviteUrl);
      setNotice(
        result.emailed
          ? `Invite emailed to ${member.email}. You can also copy the link below.`
          : 'Invite created. Copy the link below (email is not configured on the server).'
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.');
    } finally {
      setInviting(null);
    }
  };

  const handleGrantMessageAccess = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageAccessUsername) return;
    setGrantingMessageAccess(true);
    setError('');
    setNotice('');
    try {
      const member = await grantMessageAccess(messageAccessUsername);
      setMessageAccessMembers((prev) => {
        const without = prev.filter((item) => item.username !== member.username);
        return [...without, member].sort((a, b) => a.board_name.localeCompare(b.board_name));
      });
      setMessageAccessUsername('');
      setNotice(t('members.messagesAccessGranted', { name: member.board_name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not grant message access.');
    } finally {
      setGrantingMessageAccess(false);
    }
  };

  const handleRevokeMessageAccess = async (member: MessageAccessMember) => {
    const label = member.board_name || member.username;
    if (!window.confirm(t('members.messagesAccessRevokeConfirm', { name: label }))) return;

    setRevokingMessageAccess(member.username);
    setError('');
    setNotice('');
    try {
      await revokeMessageAccess(member.username);
      setMessageAccessMembers((prev) => prev.filter((item) => item.username !== member.username));
      setNotice(t('members.messagesAccessRevoked', { name: label }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke message access.');
    } finally {
      setRevokingMessageAccess(null);
    }
  };

  const copyInvite = async () => {
    if (!lastInviteUrl) return;
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      setNotice('Invite link copied.');
    } catch {
      setError('Could not copy the link. Select it and copy manually.');
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
          <h2 className="tb-heading">Manage members</h2>
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
          {!membersReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Member invites need a database table. Run{' '}
              <code className="text-xs">supabase/migrations/017_taskboard_members.sql</code> in
              Supabase SQL Editor.
            </p>
          )}

          <div className="pb-6 border-b border-[#eceff1]">
            <p className="tb-field-label mb-1">{t('members.messagesAccessHeading')}</p>
            <p className="text-xs tb-muted mb-3">{t('members.messagesAccessHint')}</p>
            {!messageAccessReady && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                {t('members.messagesAccessMigrationHint')}
              </p>
            )}
            <p className="tb-field-label mb-2 text-xs">{t('members.messagesAccessCurrent')}</p>
            {messageAccessLoading && <p className="text-sm tb-muted">{t('members.loading')}</p>}
            {!messageAccessLoading && messageAccessMembers.length === 0 && (
              <p className="text-sm tb-muted mb-3">{t('members.messagesAccessEmpty')}</p>
            )}
            {!messageAccessLoading && messageAccessMembers.length > 0 && (
              <ul className="space-y-2 mb-4">
                {messageAccessMembers.map((member) => (
                  <li
                    key={member.username}
                    className="flex items-center justify-between gap-3 py-1 border-b border-[#eceff1] last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium tb-text truncate">
                        {member.board_name || member.username}
                      </p>
                      <p className="text-xs tb-muted">{member.username}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs tb-btn-secondary shrink-0"
                      disabled={revokingMessageAccess === member.username || !messageAccessReady}
                      onClick={() => void handleRevokeMessageAccess(member)}
                    >
                      {revokingMessageAccess === member.username ? '…' : t('common.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={(e) => void handleGrantMessageAccess(e)} className="space-y-2">
              <p className="tb-field-label text-xs">{t('members.messagesAccessAddLabel')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={messageAccessUsername}
                  onChange={(e) => setMessageAccessUsername(e.target.value)}
                  className="field-input flex-1 min-w-[12rem] text-sm py-1.5"
                  disabled={!messageAccessReady || addableMessageAccessMembers.length === 0}
                >
                  <option value="">{t('members.messagesAccessAddPlaceholder')}</option>
                  {addableMessageAccessMembers.map((member) => (
                    <option key={member.username} value={member.username}>
                      {member.board_name || member.username} ({member.username})
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={
                    grantingMessageAccess ||
                    !messageAccessReady ||
                    !messageAccessUsername ||
                    addableMessageAccessMembers.length === 0
                  }
                  className="tb-btn-secondary text-xs disabled:opacity-50"
                >
                  {grantingMessageAccess
                    ? t('common.saving')
                    : t('members.messagesAccessAddButton')}
                </button>
              </div>
              {addableMessageAccessMembers.length === 0 && !messageAccessLoading ? (
                <p className="text-xs tb-muted">{t('members.messagesAccessAddNone')}</p>
              ) : null}
            </form>
          </div>

          <div>
            <p className="tb-field-label mb-1">Team on the taskboard</p>
            <p className="text-xs tb-muted mb-3">
              Everyone who can be assigned tasks appears here. Add an email and send an invite so
              they can choose their own password. Use the form below for brand-new people.
            </p>
            {loading && <p className="text-sm tb-muted">Loading members…</p>}
            {!loading && members.length === 0 && (
              <p className="text-sm tb-muted">No members yet. Add one below.</p>
            )}
            {!loading && members.length > 0 && (
              <ul className="space-y-4">
                {members.map((member) => (
                  <li
                    key={member.username}
                    className="space-y-2 pb-4 border-b border-[#eceff1] last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tb-text">
                          {member.board_name || member.username}
                          {member.isAdmin ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wider tb-muted">
                              admin
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs tb-muted">
                          {member.username}
                          {member.email ? ` · ${member.email}` : ''}
                        </p>
                        <p className="text-xs tb-text-secondary mt-1">{statusLabel(member)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {canSendInvite(member) && (
                          <button
                            type="button"
                            onClick={() => handleInvite(member)}
                            disabled={inviting === member.username}
                            className="tb-btn-secondary text-xs disabled:opacity-50"
                          >
                            {inviting === member.username
                              ? 'Sending…'
                              : member.invitePending
                                ? 'Resend invite'
                                : 'Send invite'}
                          </button>
                        )}
                        {canDeleteMember(member) && (
                          <button
                            type="button"
                            onClick={() => handleDelete(member)}
                            disabled={deleting === member.username}
                            className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                          >
                            {deleting === member.username ? 'Removing…' : 'Remove'}
                          </button>
                        )}
                      </div>
                    </div>
                    {needsEmailSetup(member) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <input
                          type="email"
                          value={emailDrafts[member.username] ?? ''}
                          onChange={(e) =>
                            setEmailDrafts((prev) => ({
                              ...prev,
                              [member.username]: e.target.value,
                            }))
                          }
                          placeholder="Email for invite"
                          className="field-input flex-1 min-w-[12rem] text-sm py-1.5"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEmail(member)}
                          disabled={savingEmail === member.username || !membersReady}
                          className="tb-btn-secondary text-xs disabled:opacity-50"
                        >
                          {savingEmail === member.username ? 'Saving…' : 'Save email'}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form className="space-y-3">
            <p className="tb-field-label">Add member</p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username (login)"
              className="field-input w-full"
              autoComplete="off"
            />
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="Name on the taskboard"
              className="field-input w-full"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="field-input w-full"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={adding || !membersReady}
                onClick={(e) => handleAdd(e, false)}
                className="tb-btn-secondary text-sm disabled:opacity-50"
              >
                {adding ? 'Saving…' : 'Add member'}
              </button>
              <button
                type="button"
                disabled={adding || !membersReady}
                onClick={(e) => handleAdd(e, true)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
              >
                Add and send invite
              </button>
            </div>
          </form>

          {lastInviteUrl && (
            <div className="space-y-2">
              <p className="tb-field-label">Invite link</p>
              <input
                readOnly
                value={lastInviteUrl}
                className="field-input w-full text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button type="button" onClick={copyInvite} className="text-xs tb-link">
                Copy link
              </button>
            </div>
          )}

          {notice && <p className="text-sm tb-text-secondary">{notice}</p>}
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
