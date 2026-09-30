import { useState } from 'react';
import ManageMembersDialog from './ManageMembersDialog';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';

export default function ManageMembersHeaderAction() {
  const { isAdmin } = useTaskboardAuth();
  const [open, setOpen] = useState(false);
  const { t } = useTaskboardI18n();

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tb-btn-secondary shrink-0 whitespace-nowrap"
      >
        {t('header.manageMembers')}
      </button>
      <ManageMembersDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
