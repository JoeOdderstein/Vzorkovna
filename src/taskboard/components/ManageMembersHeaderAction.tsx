import { useState } from 'react';
import ManageMembersDialog from './ManageMembersDialog';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';

export default function ManageMembersHeaderAction() {
  const { isAdmin } = useTaskboardAuth();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tb-btn-secondary shrink-0 whitespace-nowrap"
      >
        Manage members
      </button>
      <ManageMembersDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
