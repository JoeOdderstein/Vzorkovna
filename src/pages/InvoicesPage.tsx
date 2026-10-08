import { useState } from 'react';
import InvoicesPanel from '../components/invoices/InvoicesPanel';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';
import ManageInvoiceAccessDialog from '../taskboard/components/ManageInvoiceAccessDialog';

export default function InvoicesPage() {
  const { isAdmin } = useTaskboardAuth();
  const { t } = useTaskboardI18n();
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <span className="tb-label block mb-2">{t('nav.invoices')}</span>
          <p className="text-sm tb-muted">{t('invoices.pageDescription')}</p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="tb-btn-secondary text-sm shrink-0"
            onClick={() => setAccessDialogOpen(true)}
          >
            {t('invoices.addMembers')}
          </button>
        ) : null}
      </div>

      <InvoicesPanel />

      {isAdmin ? (
        <ManageInvoiceAccessDialog
          open={accessDialogOpen}
          onClose={() => setAccessDialogOpen(false)}
        />
      ) : null}
    </div>
  );
}
