import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Link2, Trash2, Upload } from 'lucide-react';
import UploadInvoiceDialog from './UploadInvoiceDialog';
import QuotationBudgetSection from './QuotationBudgetSection';
import InstallationPdfViewer from '../installations/InstallationPdfViewer';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { useSyncInvoicesPageQuery } from '../../hooks/useSyncInvoicesPageQuery';
import { invoiceDocumentShareUrl } from '../../lib/invoices/invoiceDocumentKindUrl';
import {
  INVOICE_DOCUMENT_KINDS,
  type InvoiceDocumentKind,
  type QuotationStatus,
} from '../../lib/invoices/constants';
import { isInvoicePdfStoragePath } from '../../lib/invoices/invoiceUploadRules';
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

function formatWhenShort(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function kindMessageKey(prefix: string, kind: InvoiceDocumentKind): string {
  return `invoices.${prefix}.${kind}`;
}

export default function InvoicesPanel() {
  const { username } = useTaskboardAuth();
  const { t } = useTaskboardI18n();
  const {
    documentKind,
    setDocumentKind,
    urlInvoiceId,
    setInvoiceIdInUrl,
    urlBudgetId,
    setBudgetIdInUrl,
  } = useSyncInvoicesPageQuery();
  const isQuotationView = documentKind === 'quotation';
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const deepLinkOpenedIdRef = useRef<string | null>(null);
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

  const openInvoice = useCallback(
    async (invoice: InvoiceRecord) => {
      setOpeningId(invoice.id);
      setError('');
      setInvoiceIdInUrl(invoice.id);
      try {
        const url = await getInvoicePdfUrl(invoice.storage_path);
        const title = invoice.title || t('invoices.defaultViewerTitle');
        if (isInvoicePdfStoragePath(invoice.storage_path)) {
          setViewer({ url, title });
        } else {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } catch {
        setError(t('invoices.openError'));
      } finally {
        setOpeningId(null);
      }
    },
    [setInvoiceIdInUrl, t],
  );

  useEffect(() => {
    if (loading || !urlInvoiceId) return;

    const invoice = invoices.find((row) => row.id === urlInvoiceId);
    if (!invoice) {
      setInvoiceIdInUrl(null);
      deepLinkOpenedIdRef.current = null;
      return;
    }

    if (invoice.document_kind !== documentKind) {
      setDocumentKind(invoice.document_kind);
      return;
    }

    const rowEl = document.getElementById(`invoice-row-${invoice.id}`);
    rowEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    if (deepLinkOpenedIdRef.current === urlInvoiceId) return;
    deepLinkOpenedIdRef.current = urlInvoiceId;
    void openInvoice(invoice);
  }, [
    loading,
    urlInvoiceId,
    invoices,
    documentKind,
    setDocumentKind,
    setInvoiceIdInUrl,
    openInvoice,
  ]);

  const copyDocumentLink = async (invoice: InvoiceRecord) => {
    setShareNotice('');
    const url = invoiceDocumentShareUrl(invoice);
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(t('invoices.shareDocumentCopied'));
    } catch {
      setShareNotice(url);
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
      if (urlInvoiceId === invoice.id) setInvoiceIdInUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleQuotationStatus = async (
    invoice: InvoiceRecord,
    status: QuotationStatus,
    checked: boolean,
  ) => {
    if (!username) return;
    setSavingId(invoice.id);
    setError('');
    try {
      const updated = await updateInvoiceStatus(
        invoice.id,
        { quotation_status: checked ? status : null },
        username,
      );
      setInvoices((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('invoices.updateFailed'));
    } finally {
      setSavingId(null);
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
    <div className="flex flex-col gap-3 min-w-0">
      <div
        className="tb-header-scroll-row tb-header-scroll-row--filters shrink-0 -mx-1 px-1 sm:mx-0 sm:px-0"
        role="group"
        aria-label={t('invoices.filterByKind')}
      >
        {INVOICE_DOCUMENT_KINDS.map((kind) => {
          const count = kind === 'quotation' ? 0 : (countsByKind.get(kind) ?? 0);
          const active = documentKind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setDocumentKind(kind);
                setInvoiceIdInUrl(null);
                deepLinkOpenedIdRef.current = null;
              }}
              className={`tb-filter-btn relative ${active ? 'tb-filter-btn--active' : ''}`}
            >
              {t(kindMessageKey('kind', kind))}
              {count > 0 ? <span className="tb-filter-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {isQuotationView ? (
        <QuotationBudgetSection urlBudgetId={urlBudgetId} setBudgetIdInUrl={setBudgetIdInUrl} />
      ) : null}

      {!isQuotationView ? (
      <section className="tb-remote-inst-card p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div className="min-w-0">
          <h2 className="tb-heading text-lg">
            {isQuotationView ? t('quotations.uploadedFilesHeading') : t(kindMessageKey('listHeading', documentKind))}
          </h2>
          <p className="text-sm tb-muted mt-1">
            {isQuotationView ? t('invoices.uploadHint.quotation') : t('invoices.uploadHint')}
          </p>
        </div>
        <div className="w-full sm:w-auto shrink-0">
          <button
            type="button"
            className="tb-btn-primary text-sm inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            disabled={!username}
            onClick={() => setUploadDialogOpen(true)}
          >
            <Upload size={16} aria-hidden />
            {t(kindMessageKey('upload', documentKind))}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
      {shareNotice ? <p className="text-sm text-[var(--tb-accent)] mb-4">{shareNotice}</p> : null}

      {loading ? <p className="text-sm tb-muted">{t('common.loading')}</p> : null}

      {!loading && filteredInvoices.length === 0 ? (
        <p className="text-sm tb-muted">{t(kindMessageKey('empty', documentKind))}</p>
      ) : null}

      {!loading && filteredInvoices.length > 0 ? (
        <div className="min-w-0">
          <div
            className={`hidden ${DESKTOP_GRID} px-3 pb-2 mb-2 text-[10px] uppercase tracking-wider tb-muted border-b border-[var(--tb-border)]`}
          >
            <span className="text-center">{t('invoices.colPdf')}</span>
            <span>{t('invoices.colName')}</span>
            <span className="text-center px-1 leading-snug">
              {isQuotationView ? t('invoices.colApproved') : t('invoices.colFinance')}
            </span>
            <span className="text-center px-1 leading-snug">
              {isQuotationView ? t('invoices.colRevisionsNeeded') : t('invoices.colPayment')}
            </span>
          </div>
          <ul className="space-y-1 md:space-y-2 tb-invoice-list">
            {filteredInvoices.map((invoice) => {
              const busy = savingId === invoice.id || deletingId === invoice.id;
              const opening = openingId === invoice.id;
              const showDelete = canDeleteInvoice(invoice);
              const ownerName = labelForUser(invoice.uploaded_by);
              const showMeta = isQuotationView
                ? Boolean(invoice.quotation_status && invoice.quotation_status_by)
                : (invoice.forwarded_to_finance && invoice.forwarded_to_finance_by) ||
                  (invoice.payment_received && invoice.payment_received_by);

              const highlighted = urlInvoiceId === invoice.id;

              return (
                <li
                  key={invoice.id}
                  id={`invoice-row-${invoice.id}`}
                  className={`tb-invoice-row border rounded-lg p-2 md:p-3 ${
                    highlighted
                      ? 'border-[var(--tb-accent)] ring-1 ring-[var(--tb-accent)]/40'
                      : 'border-[var(--tb-border)]'
                  }`}
                >
                  <div
                    className={`grid gap-2 md:gap-3 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_auto] ${DESKTOP_GRID}`}
                  >
                    <div className="row-start-1 col-start-1 flex justify-center items-start md:justify-center md:items-center md:row-auto md:col-auto">
                      <button
                        type="button"
                        className="tb-invoice-row__open flex items-center justify-center w-9 h-9 md:w-10 md:h-10 shrink-0 rounded-md border border-[var(--tb-border)] bg-[var(--tb-bg)] text-[var(--tb-accent)] hover:bg-[var(--tb-surface-hover,var(--tb-border))] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tb-accent)]"
                        disabled={opening}
                        onClick={() => void openInvoice(invoice)}
                        aria-label={`${t('invoices.openPdf')}: ${invoice.title}`}
                      >
                        <FileText className="h-[17px] w-[17px] md:h-[22px] md:w-[22px]" aria-hidden />
                      </button>
                    </div>

                    <div className="row-start-1 col-start-2 min-w-0 md:py-1 md:row-auto md:col-auto">
                      <div className="flex items-start gap-1.5 md:gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm tb-text font-medium truncate leading-snug">
                            {ownerName}
                            <span className="font-normal tb-muted md:hidden">
                              {' · '}
                              {formatWhenShort(invoice.created_at)}
                            </span>
                          </p>
                          <button
                            type="button"
                            className="mt-px md:mt-0.5 text-xs md:text-sm tb-text hover:text-[var(--tb-accent)] text-left w-full min-w-0 leading-snug"
                            disabled={opening}
                            onClick={() => void openInvoice(invoice)}
                          >
                            <span className="line-clamp-1 break-words md:truncate md:line-clamp-none">
                              {invoice.title}
                            </span>
                            {opening ? (
                              <span className="text-[10px] md:text-xs tb-muted">
                                {' '}
                                ({t('invoices.opening')})
                              </span>
                            ) : null}
                          </button>
                          <p className="text-xs tb-muted mt-0.5 hidden md:block">
                            {formatWhen(invoice.created_at)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 md:gap-1">
                          <button
                            type="button"
                            className="p-1.5 md:p-2 rounded-md border border-[var(--tb-border)] text-[var(--tb-text-muted)] hover:text-[var(--tb-accent)] transition-colors disabled:opacity-50"
                            disabled={busy}
                            aria-label={t('invoices.shareDocument')}
                            title={t('invoices.shareDocument')}
                            onClick={() => void copyDocumentLink(invoice)}
                          >
                            <Link2 className="h-[15px] w-[15px] md:h-4 md:w-4" aria-hidden />
                          </button>
                          {showDelete ? (
                            <button
                              type="button"
                              className="p-1.5 md:p-2 rounded-md border border-[var(--tb-border)] text-[var(--tb-text-muted)] hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
                              disabled={busy}
                              aria-label={t('invoices.delete')}
                              title={t('invoices.delete')}
                              onClick={() => void handleDelete(invoice)}
                            >
                              <Trash2 className="h-[15px] w-[15px] md:h-4 md:w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="tb-invoice-row__status row-start-2 col-span-2 grid grid-cols-2 gap-1.5 p-1.5 rounded-md border border-[var(--tb-border)] bg-[color-mix(in_srgb,var(--tb-text)_4%,var(--tb-surface))] md:col-span-1 md:row-start-auto md:contents md:p-0 md:border-0 md:bg-transparent md:rounded-none md:gap-0">
                      {isQuotationView ? (
                        <>
                          <div className="min-w-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                            <label className="flex items-center gap-1.5 min-w-0 md:flex-col md:items-center md:gap-0">
                              <input
                                type="checkbox"
                                className="tb-invoice-checkbox"
                                checked={invoice.quotation_status === 'approved'}
                                disabled={busy}
                                aria-label={t('invoices.quotationApproved')}
                                onChange={(e) =>
                                  void toggleQuotationStatus(invoice, 'approved', e.target.checked)
                                }
                              />
                              <span className="text-[10px] leading-tight tb-muted md:hidden line-clamp-2">
                                {t('invoices.colApproved')}
                              </span>
                            </label>
                            {invoice.quotation_status === 'approved' && invoice.quotation_status_by ? (
                              <span className="text-[9px] tb-muted leading-tight mt-0.5 line-clamp-2 md:col-span-1 md:text-center md:max-w-[10.5rem] md:mt-2 md:text-[10px] md:hidden">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.quotation_status_by),
                                  when: formatWhenShort(invoice.quotation_status_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                            <label className="flex items-center gap-1.5 min-w-0 md:flex-col md:items-center md:gap-0">
                              <input
                                type="checkbox"
                                className="tb-invoice-checkbox"
                                checked={invoice.quotation_status === 'revisions_needed'}
                                disabled={busy}
                                aria-label={t('invoices.quotationRevisionsNeeded')}
                                onChange={(e) =>
                                  void toggleQuotationStatus(
                                    invoice,
                                    'revisions_needed',
                                    e.target.checked,
                                  )
                                }
                              />
                              <span className="text-[10px] leading-tight tb-muted md:hidden line-clamp-2">
                                {t('invoices.colRevisionsNeeded')}
                              </span>
                            </label>
                            {invoice.quotation_status === 'revisions_needed' &&
                            invoice.quotation_status_by ? (
                              <span className="text-[9px] tb-muted leading-tight mt-0.5 line-clamp-2 md:text-center md:max-w-[10.5rem] md:mt-2 md:text-[10px] md:hidden">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.quotation_status_by),
                                  when: formatWhenShort(invoice.quotation_status_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                            <label className="flex items-center gap-1.5 min-w-0 md:flex-col md:items-center md:gap-0">
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
                              <span className="text-[10px] leading-tight tb-muted md:hidden line-clamp-2">
                                {t('invoices.colFinance')}
                              </span>
                            </label>
                            {invoice.forwarded_to_finance && invoice.forwarded_to_finance_by ? (
                              <span className="text-[9px] tb-muted leading-tight mt-0.5 line-clamp-2 md:text-center md:max-w-[10.5rem] md:mt-2 md:text-[10px] md:hidden">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.forwarded_to_finance_by),
                                  when: formatWhenShort(invoice.forwarded_to_finance_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="min-w-0 md:flex md:flex-col md:items-center md:justify-center md:min-h-[2.5rem]">
                            <label className="flex items-center gap-1.5 min-w-0 md:flex-col md:items-center md:gap-0">
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
                              <span className="text-[10px] leading-tight tb-muted md:hidden line-clamp-2">
                                {t('invoices.colPayment')}
                              </span>
                            </label>
                            {invoice.payment_received && invoice.payment_received_by ? (
                              <span className="text-[9px] tb-muted leading-tight mt-0.5 line-clamp-2 md:text-center md:max-w-[10.5rem] md:mt-2 md:text-[10px] md:hidden">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.payment_received_by),
                                  when: formatWhenShort(invoice.payment_received_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {showMeta ? (
                    <div className={`hidden ${DESKTOP_GRID} px-0 pt-1`}>
                      <div aria-hidden />
                      <div aria-hidden />
                      {isQuotationView ? (
                        <>
                          <div className="text-center px-1">
                            {invoice.quotation_status === 'approved' && invoice.quotation_status_by ? (
                              <span className="text-[10px] tb-muted leading-snug block">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.quotation_status_by),
                                  when: formatWhen(invoice.quotation_status_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                          <div className="text-center px-1">
                            {invoice.quotation_status === 'revisions_needed' &&
                            invoice.quotation_status_by ? (
                              <span className="text-[10px] tb-muted leading-snug block">
                                {t('invoices.markedBy', {
                                  name: labelForUser(invoice.quotation_status_by),
                                  when: formatWhen(invoice.quotation_status_at),
                                })}
                              </span>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <UploadInvoiceDialog
        open={uploadDialogOpen}
        documentKind={documentKind}
        onClose={() => setUploadDialogOpen(false)}
        onUploaded={(created) => setInvoices((prev) => [created, ...prev])}
      />
      </section>
      ) : null}

      {viewer ? (
        <InstallationPdfViewer
          pdfUrl={viewer.url}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
