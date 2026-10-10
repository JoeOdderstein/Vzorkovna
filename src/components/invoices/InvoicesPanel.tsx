import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';
import UploadInvoiceDialog from './UploadInvoiceDialog';
import InstallationPdfViewer from '../installations/InstallationPdfViewer';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  INVOICE_DOCUMENT_KINDS,
  type InvoiceDocumentKind,
} from '../../lib/invoices/constants';
import {
  deleteInvoice,
  getInvoicePdfUrl,
  listInvoices,
  updateInvoiceStatus,
  type InvoiceRecord,
} from '../../lib/invoices/invoiceService';
import { notifyInvoiceForwarded } from '../../lib/invoices/notifyInvoiceForwarded';
import { fetchMembers } from '../../lib/taskboard/memberService';

/** Shared desktop column template — keep header, body, and meta rows aligned. */
const DESKTOP_GRID =
  'md:grid md:grid-cols-[2.75rem_minmax(0,1fr)_10.5rem_10.5rem] md:gap-x-4 md:items-center';

function formatWhen(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindMessageKey(prefix: string, kind: InvoiceDocumentKind): string {
  return `invoices.${prefix}.${kind}`;
}

export default function InvoicesPanel() {
  const { username } = useTaskboardAuth();
  const { t } = useTaskboardI18n();
  const [documentKind, setDocumentKind] = useState<InvoiceDocumentKind>('invoice');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    void listInvoices()
      .then(setInvoices)
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('invoices.listError'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
    void fetchMembers()
      .then(({ members }) => {
        const map: Record<string, string> = {};
        for (const member of members) {
          map[member.username] = member.board_name || member.username;
        }
        setDisplayNames(map);
      })
      .catch(() => {
        /* display names optional */
      });
  }, [load]);

  const labelForUser = useMemo(
    () => (user: string | null | undefined) => {
      if (!user) return '—';
      return displayNames[user] ?? user;
    },
    [displayNames],
  );

  const countsByKind = useMemo(() => {
    const counts = new Map<InvoiceDocumentKind, number>();
    for (const kind of INVOICE_DOCUMENT_KINDS) counts.set(kind, 0);
    for (const row of invoices) {
      counts.set(row.document_kind, (counts.get(row.document_kind) ?? 0) + 1);
    }
    return counts;
  }, [invoices]);

  const filteredInvoices = useMemo(
    () => invoices.filter((row) => row.document_kind === documentKind),
    [invoices, documentKind],
  );

  const openInvoice = async (invoice: InvoiceRecord) => {
    setOpeningId(invoice.id);
    setError('');
    try {
      const url = await getInvoicePdfUrl(invoice.storage_path);
      setViewer({ url, title: invoice.title || t('invoices.defaultViewerTitle') });
    } catch {
      setError(t('invoices.openError'));
    } finally {
      setOpeningId(null);
    }
  };

  const canDeleteInvoice = useCallback(
    (invoice: InvoiceRecord) =>
      Boolean(username && invoice.uploaded_by.trim().toLowerCase() === username.trim().toLowerCase()),
    [username],
  );

  const handleDelete = async (invoice: InvoiceRecord) => {
    if (!username || !canDeleteInvoice(invoice)) return;
    if (!window.confirm(t('invoices.deleteConfirm'))) return;

    setDeletingId(invoice.id);
    setError('');
    try {
      await deleteInvoice(invoice.id, username);
      setInvoices((prev) => prev.filter((row) => row.id !== invoice.id));
      if (viewer?.title === invoice.title) setViewer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleField = async (
    invoice: InvoiceRecord,
    field: 'forwarded_to_finance' | 'payment_received',
    next: boolean,
  ) => {
    if (!username) return;
    setSavingId(invoice.id);
    setError('');
    try {
      const updated = await updateInvoiceStatus(
        invoice.id,
        field === 'forwarded_to_finance'
          ? { forwarded_to_finance: next }
          : { payment_received: next },
        username,
      );
      setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));

      if (field === 'forwarded_to_finance' && next) {
        try {
          await notifyInvoiceForwarded(invoice.id);
        } catch (notifyErr) {
          console.warn('Invoice updated but uploader notify failed:', notifyErr);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.updateFailed'));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="tb-header-scroll-row tb-header-scroll-row--filters shrink-0"
        role="group"
        aria-label={t('invoices.filterByKind')}
      >
        {INVOICE_DOCUMENT_KINDS.map((kind) => {
          const count = countsByKind.get(kind) ?? 0;
          const active = documentKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setDocumentKind(kind)}
              className={`tb-filter-btn relative ${active ? 'tb-filter-btn--active' : ''}`}
            >
              {t(kindMessageKey('kind', kind))}
              {count > 0 ? <span className="tb-filter-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      <section className="tb-remote-inst-card p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="tb-heading text-lg">{t(kindMessageKey('listHeading', documentKind))}</h2>
          <p className="text-sm tb-muted mt-1">{t('invoices.uploadHint')}</p>
        </div>
        <div>
          <button
            type="button"
            className="tb-btn-primary text-sm inline-flex items-center gap-2"
            disabled={!username}
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload size={16} aria-hidden />
            {t(kindMessageKey('upload', documentKind))}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}

      {loading ? <p className="text-sm tb-muted">{t('common.loading')}</p> : null}

      {!loading && filteredInvoices.length === 0 ? (
        <p className="text-sm tb-muted">{t(kindMessageKey('empty', documentKind))}</p>
      ) : null}

      {!loading && filteredInvoices.length > 0 ? (
        <div className="overflow-x-auto">
          <div
            className={`hidden ${DESKTOP_GRID} px-3 pb-2 mb-2 text-[10px] uppercase tracking-wider tb-muted border-b border-[var(--tb-border)]`}
          >
            <span className="text-center">{t('invoices.colPdf')}</span>
            <span>{t('invoices.colName')}</span>
            <span className="text-center px-1 leading-snug">
              {t('invoices.colFinance')}
            </span>
            <span className="text-center px-1 leading-snug">{t('invoices.colPayment')}</span>
          </div>
          <ul className="space-y-2">
            {filteredInvoices.map((invoice) => {
              const busy = savingId === invoice.id || deletingId === invoice.id;
              const opening = openingId === invoice.id;
              const showDelete = canDeleteInvoice(invoice);
              const ownerName = labelForUser(invoice.uploaded_by);
              const showMeta =
                (invoice.forwarded_to_finance && invoice.forwarded_to_finance_by) ||
                (invoice.payment_received && invoice.payment_received_by);

              return (
                <li
                  key={invoice.id}
                  className="border border-[var(--tb-border)] rounded-lg px-3 py-3 space-y-2"
                >
                  <div className={`grid grid-cols-1 gap-3 ${DESKTOP_GRID}`}>
                    <div className="flex justify-start md:justify-center md:items-center">
                      <button
                        type="button"
                        className="flex items-center justify-center w-10 h-10 shrink-0 rounded-md border border-[var(--tb-border)] bg-[var(--tb-bg)] text-[var(--tb-accent)] hover:bg-[var(--tb-surface-hover,var(--tb-border))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tb-accent)]"
                        disabled={opening}
                        onClick={() => void openInvoice(invoice)}
                        aria-label={`${t('invoices.openPdf')}: ${invoice.title}`}
                      >
                        <FileText size={22} aria-hidden />
                      </button>
                    </div>

                    <div className="min-w-0 border-t md:border-t-0 border-[var(--tb-border)] pt-3 md:pt-0 md:py-1">
                      <span className="text-[10px] uppercase tracking-wider tb-muted md:hidden mb-1 block">
                        {t('invoices.colName')}
                      </span>
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm tb-text font-medium truncate">{ownerName}</p>
                          <button
                            type="button"
                            className="mt-1 text-xs tb-muted hover:text-[var(--tb-accent)] text-left truncate max-w-full block"
                            disabled={opening}
                            onClick={() => void openInvoice(invoice)}
                          >
                            {invoice.title}
                            {opening ? ` (${t('invoices.opening')})` : ''}
                            {' · '}
                            {formatWhen(invoice.created_at)}
                          </button>
                        </div>
                        {showDelete ? (
                          <button
                            type="button"
                            className="shrink-0 p-2 rounded-md border border-[var(--tb-border)] text-[var(--tb-text-muted)] hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                            disabled={busy}
                            aria-label={t('invoices.delete')}
                            title={t('invoices.delete')}
                            onClick={() => void handleDelete(invoice)}
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <span className="text-xs tb-muted block mt-1 md:hidden">
                        {t('invoices.openPdfHint')}
                      </span>
                    </div>

                    <div className="border-t md:border-t-0 border-[var(--tb-border)] pt-3 md:pt-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                      <span className="text-[10px] uppercase tracking-wider tb-muted md:hidden mb-2 block">
                        {t('invoices.colFinance')}
                      </span>
                      <input
                        type="checkbox"
                        className="tb-invoice-checkbox"
                        checked={invoice.forwarded_to_finance}
                        disabled={busy}
                        aria-label={t('invoices.forwardedToFinance')}
                        onChange={(e) =>
                          void toggleField(invoice, 'forwarded_to_finance', e.target.checked)
                        }
                      />
                      {invoice.forwarded_to_finance && invoice.forwarded_to_finance_by ? (
                        <span className="text-[10px] tb-muted leading-snug mt-2 text-left md:text-center md:max-w-[10.5rem] md:hidden">
                          {t('invoices.markedBy', {
                            name: labelForUser(invoice.forwarded_to_finance_by),
                            when: formatWhen(invoice.forwarded_to_finance_at),
                          })}
                        </span>
                      ) : null}
                    </div>

                    <div className="border-t md:border-t-0 border-[var(--tb-border)] pt-3 md:pt-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                      <span className="text-[10px] uppercase tracking-wider tb-muted md:hidden mb-2 block">
                        {t('invoices.colPayment')}
                      </span>
                      <input
                        type="checkbox"
                        className="tb-invoice-checkbox"
                        checked={invoice.payment_received}
                        disabled={busy}
                        aria-label={t('invoices.paymentReceived')}
                        onChange={(e) =>
                          void toggleField(invoice, 'payment_received', e.target.checked)
                        }
                      />
                      {invoice.payment_received && invoice.payment_received_by ? (
                        <span className="text-[10px] tb-muted leading-snug mt-2 text-left md:text-center md:max-w-[10.5rem] md:hidden">
                          {t('invoices.markedBy', {
                            name: labelForUser(invoice.payment_received_by),
                            when: formatWhen(invoice.payment_received_at),
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {showMeta ? (
                    <div className={`hidden ${DESKTOP_GRID} px-0 pt-1`}>
                      <div aria-hidden />
                      <div aria-hidden />
                      <div className="text-center px-1">
                        {invoice.forwarded_to_finance && invoice.forwarded_to_finance_by ? (
                          <span className="text-[10px] tb-muted leading-snug block">
                            {t('invoices.markedBy', {
                              name: labelForUser(invoice.forwarded_to_finance_by),
                              when: formatWhen(invoice.forwarded_to_finance_at),
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-center px-1">
                        {invoice.payment_received && invoice.payment_received_by ? (
                          <span className="text-[10px] tb-muted leading-snug block">
                            {t('invoices.markedBy', {
                              name: labelForUser(invoice.payment_received_by),
                              when: formatWhen(invoice.payment_received_at),
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {viewer ? (
        <InstallationPdfViewer
          pdfUrl={viewer.url}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      ) : null}

      <UploadInvoiceDialog
        open={uploadDialogOpen}
        documentKind={documentKind}
        onClose={() => setUploadDialogOpen(false)}
        onUploaded={(created) => setInvoices((prev) => [created, ...prev])}
      />
      </section>
    </div>
  );
}
