import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  createMember,
  fetchMembers,
  sendMemberInvite,
  type TaskboardMember,
} from '../../lib/taskboard/memberService';

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

export default function ManageMembersDialog({ open, onClose }: ManageMembersDialogProps) {
  const [members, setMembers] = useState<TaskboardMember[]>([]);
  const [membersReady, setMembersReady] = useState(true);
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

  const load = () => {
    setLoading(true);
    fetchMembers()
      .then(({ members: list, membersReady: ready }) => {
        setMembers(list);
        setMembersReady(ready);
        setEmailDrafts((prev) => {
          const next = { ...prev };
          for (const member of list) {
            if (member.email) next[member.username] = member.email;
            else if (next[member.username] === undefined) next[member.username] = '';
          }
          return next;
        });
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not load members.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setUsername('');
    setBoardName('');
    setEmail('');
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
                      {canSendInvite(member) && (
                        <button
                          type="button"
                          onClick={() => handleInvite(member)}
                          disabled={inviting === member.username}
                          className="tb-btn-secondary text-xs shrink-0 disabled:opacity-50"
                        >
                          {inviting === member.username
                            ? 'Sending…'
                            : member.invitePending
                              ? 'Resend invite'
                              : 'Send invite'}
                        </button>
                      )}
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
