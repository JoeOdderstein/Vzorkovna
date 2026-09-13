import { FormEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { defaultBoardNameForUsername } from '../../lib/taskboard/boardNameUtils';
import { getErrorMessage } from '../../lib/taskboard/profileErrors';

interface ProfileSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ProfileSettingsDialog({ open, onClose }: ProfileSettingsDialogProps) {
  const { username } = useTaskboardAuth();
  const { profile, loading, profilesReady, error, updateProfile } = useUserProfile();
  const [email, setEmail] = useState('');
  const [notifyOnAssign, setNotifyOnAssign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const boardName = useMemo(() => {
    if (profile?.board_name) return profile.board_name;
    if (username) return defaultBoardNameForUsername(username);
    return null;
  }, [profile?.board_name, username]);

  useEffect(() => {
    if (!open || !profile) return;
    setEmail(profile.email ?? '');
    setNotifyOnAssign(profile.notify_on_assign);
    setFormError('');
  }, [open, profile]);

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      await updateProfile({
        email: email.trim() || null,
        notify_on_assign: notifyOnAssign,
      });
      onClose();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Could not save profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} />
      <div
        className="relative w-full max-w-lg tb-calendar-panel max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b tb-calendar-border flex items-center justify-between shrink-0">
          <h2 className="tb-heading">Profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 overflow-y-auto flex-1 space-y-5">
          {!profilesReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              Profiles are not set up yet. Run{' '}
              <code className="text-xs">supabase/migrations/009_user_profiles.sql</code> and{' '}
              <code className="text-xs">010_user_profile_board_name.sql</code> in Supabase SQL
              Editor.
            </p>
          )}

          <div>
            <p className="tb-field-label mb-1.5">Login username</p>
            <p className="text-sm tb-text">{username}</p>
          </div>

          <div>
            <p className="tb-field-label mb-1.5">Your name on the taskboard</p>
            <p className="text-sm tb-text">{boardName ?? 'Not configured'}</p>
            <p className="text-xs tb-muted mt-1.5">
              Linked automatically from your login. Tasks assigned to{' '}
              <strong>{boardName ?? 'your name'}</strong> on the board will notify the email below.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="tb-field-label">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field-input w-full"
              disabled={loading || saving || !profilesReady}
            />
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={notifyOnAssign}
              onChange={(e) => setNotifyOnAssign(e.target.checked)}
              disabled={loading || saving || !profilesReady}
              className="tb-task-checkbox mt-0.5"
            />
            <span>
              <span className="block text-sm tb-text">Email me when I am assigned to a task</span>
              <span className="block text-xs tb-muted mt-1">
                Requires a saved email above.
              </span>
            </span>
          </label>

          {(formError || error) && <p className="text-sm text-red-600">{formError || error}</p>}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || saving || !profilesReady || !username || !boardName}
              className="tb-btn-primary disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            <button type="button" onClick={onClose} className="tb-link px-2 py-1">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
