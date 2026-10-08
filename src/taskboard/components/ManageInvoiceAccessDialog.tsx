import { FormEvent, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  fetchInvoiceAccessMembers,
  grantInvoiceAccess,
  revokeInvoiceAccess,
  type InvoiceAccessMember,
} from '../../lib/taskboard/invoiceAccessService';
import { fetchMembers, type TaskboardMember } from '../../lib/taskboard/memberService';

interface ManageInvoiceAccessDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ManageInvoiceAccessDialog({ open, onClose }: ManageInvoiceAccessDialogProps) {
  const { t } = useTaskboardI18n();
  const [accessMembers, setAccessMembers] = useState<InvoiceAccessMember[]>([]);
  const [taskboardMembers, setTaskboardMembers] = useState<TaskboardMember[]>([]);
  const [accessReady, setAccessReady] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [adding, setAdding] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const grantedUsernames = useMemo(
    () => new Set(accessMembers.map((member) => member.username)),
    [accessMembers],
  );

  const addableMembers = useMemo(
    () =>
      taskboardMembers
        .filter((member) => !member.isAdmin && !grantedUsernames.has(member.username))
        .sort((a, b) => {
          const nameA = a.board_name || a.username;
          const nameB = b.board_name || b.username;
          return nameA.localeCompare(nameB);
        }),
    [taskboardMembers, grantedUsernames],
  );

  const load = () => {
    setLoading(true);
    Promise.all([fetchInvoiceAccessMembers(), fetchMembers()])
      .then(([access, roster]) => {
        setAccessMembers(access.members);
        setAccessReady(access.invoiceAccessReady);
        setTaskboardMembers(roster.members);
        setError('');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('invoices.accessLoadError'));
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    setSelectedUsername('');
    setNotice('');
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

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUsername) return;
    setAdding(true);
    setError('');
    setNotice('');
    try {
      const member = await grantInvoiceAccess(selectedUsername);
      setAccessMembers((prev) => {
        const without = prev.filter((item) => item.username !== member.username);
        return [...without, member].sort((a, b) => a.board_name.localeCompare(b.board_name));
      });
      setSelectedUsername('');
      setNotice(t('invoices.accessGranted', { name: member.board_name }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.accessGrantError'));
    } finally {
      setAdding(false);
    }
  };

  const handleRevoke = async (member: InvoiceAccessMember) => {
    const label = member.board_name || member.username;
    if (!window.confirm(t('invoices.accessRevokeConfirm', { name: label }))) return;

    setRevoking(member.username);
    setError('');
    setNotice('');
    try {
      await revokeInvoiceAccess(member.username);
      setAccessMembers((prev) => prev.filter((item) => item.username !== member.username));
      setNotice(t('invoices.accessRevoked', { name: label }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.accessRevokeError'));
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="taskboard fixed inset-0 z-[80] flex items-center justify-center px-6">
      <div className="absolute inset-0 tb-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-labelledby="invoice-access-dialog-title"
        className="relative w-full max-w-lg bg-white border border-[#dadce0] rounded-lg shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#dadce0] flex items-center justify-between shrink-0">
          <h2 id="invoice-access-dialog-title" className="tb-heading">
            {t('invoices.addMembers')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-[#80868b] hover:text-[#202124] transition-colors"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1 space-y-6">
          {!accessReady && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {t('invoices.accessMigrationHint')}
            </p>
          )}

          <p className="text-sm tb-muted">{t('invoices.accessDialogDescription')}</p>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {notice ? <p className="text-sm text-green-700">{notice}</p> : null}

          <div>
            <p className="tb-field-label mb-2">{t('invoices.accessCurrentList')}</p>
            {loading && <p className="text-sm tb-muted">{t('common.loading')}</p>}
            {!loading && accessMembers.length === 0 && (
              <p className="text-sm tb-muted">{t('invoices.accessEmpty')}</p>
            )}
            {!loading && accessMembers.length > 0 && (
              <ul className="space-y-2">
                {accessMembers.map((member) => (
                  <li
                    key={member.username}
                    className="flex items-center justify-between gap-3 py-2 border-b border-[#dadce0] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm tb-text font-medium truncate">{member.board_name}</p>
                      <p className="text-xs tb-muted">{member.username}</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs tb-btn-secondary shrink-0"
                      disabled={revoking === member.username}
                      onClick={() => void handleRevoke(member)}
                    >
                      {revoking === member.username ? t('common.saving') : t('common.remove')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={handleAdd} className="space-y-3 border-t border-[#dadce0] pt-4">
            <p className="tb-field-label">{t('invoices.accessAddLabel')}</p>
            <select
              value={selectedUsername}
              onChange={(e) => setSelectedUsername(e.target.value)}
              className="field-input w-full"
              disabled={adding || addableMembers.length === 0}
            >
              <option value="">{t('invoices.accessAddPlaceholder')}</option>
              {addableMembers.map((member) => (
                <option key={member.username} value={member.username}>
                  {member.board_name || member.username} ({member.username})
                </option>
              ))}
            </select>
            {addableMembers.length === 0 && !loading ? (
              <p className="text-xs tb-muted">{t('invoices.accessAddNone')}</p>
            ) : null}
            <button
              type="submit"
              className="tb-btn-primary text-sm"
              disabled={adding || !selectedUsername}
            >
              {adding ? t('common.saving') : t('invoices.accessAddButton')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
