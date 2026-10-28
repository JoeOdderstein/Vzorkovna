import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Eye, FileSpreadsheet, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { fetchVisibleProjects } from '../../lib/taskboard/taskService';
import type { Project } from '../../lib/taskboard/types';
import { parseBudgetXlsxToDraft } from '../../lib/quotations/parseBudgetXlsx';
import { draftEmptyQuotation } from '../../lib/quotations/emptyQuotationDraft';
import {
  createProjectQuotation,
  deleteProjectQuotation,
  duplicateProjectQuotation,
  fetchProjectQuotation,
  listProjectQuotations,
} from '../../lib/quotations/quotationBudgetService';
import { formatQuotationMoney, recomputeQuotationLines } from '../../lib/quotations/quotationBudgetCalc';
import { quotationBudgetShareUrl } from '../../lib/quotations/quotationBudgetUrl';
import type { ProjectQuotation } from '../../lib/quotations/types';
import QuotationBudgetEditor from './QuotationBudgetEditor';

interface QuotationBudgetSectionProps {
  urlBudgetId: string | null;
  setBudgetIdInUrl: (budgetId: string | null) => void;
}

export default function QuotationBudgetSection({
  urlBudgetId,
  setBudgetIdInUrl,
}: QuotationBudgetSectionProps) {
  const { username, isAdmin, canEditQuotations } = useTaskboardAuth();
  const { t } = useTaskboardI18n();
  const importInputRef = useRef<HTMLInputElement>(null);
  const deepLinkOpenedBudgetRef = useRef<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [budgets, setBudgets] = useState<ProjectQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shareNotice, setShareNotice] = useState('');
  const [creatingProjectId, setCreatingProjectId] = useState('');
  const [editorQuotation, setEditorQuotation] = useState<ProjectQuotation | null>(null);
  const [editorReadOnly, setEditorReadOnly] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void listProjectQuotations()
      .then(setBudgets)
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('quotations.budgetLoadError'));
      })
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
    void fetchVisibleProjects(username, isAdmin)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [load, username, isAdmin]);

  useEffect(() => {
    if (!creatingProjectId && projects[0]) {
      setCreatingProjectId(projects[0].id);
    }
  }, [projects, creatingProjectId]);

  const openEditor = async (id: string, readOnly: boolean) => {
    setBusyId(id);
    setError('');
    setBudgetIdInUrl(id);
    try {
      const full = await fetchProjectQuotation(id);
      setEditorReadOnly(readOnly);
      setEditorQuotation(full);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetLoadError'));
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    if (loading || !urlBudgetId) return;

    const row = budgets.find((b) => b.id === urlBudgetId);
    if (!row) {
      setBudgetIdInUrl(null);
      deepLinkOpenedBudgetRef.current = null;
      return;
    }

    if (deepLinkOpenedBudgetRef.current === urlBudgetId) return;
    deepLinkOpenedBudgetRef.current = urlBudgetId;
    void openEditor(urlBudgetId, !canEditQuotations);
  }, [loading, urlBudgetId, budgets, canEditQuotations, setBudgetIdInUrl]);

  const closeEditor = () => {
    setEditorQuotation(null);
    setBudgetIdInUrl(null);
    deepLinkOpenedBudgetRef.current = null;
  };

  const createNewBudget = async () => {
    if (!username || !creatingProjectId || !canEditQuotations) return;
    setBusyId('create');
    setError('');
    try {
      const draft = draftEmptyQuotation(creatingProjectId);
      const created = await createProjectQuotation(draft, username);
      setBudgets((prev) => [created, ...prev]);
      const full = await fetchProjectQuotation(created.id);
      setEditorReadOnly(false);
      setEditorQuotation(full);
      setBudgetIdInUrl(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetCreateError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleImportFile = async (file: File) => {
    if (!username || !creatingProjectId || !canEditQuotations) return;
    const project = projects.find((p) => p.id === creatingProjectId);
    if (!project) return;
    setBusyId('import');
    setError('');
    try {
      const buffer = await file.arrayBuffer();
      const draft = parseBudgetXlsxToDraft(buffer, creatingProjectId, project.name);
      const created = await createProjectQuotation(draft, username);
      setBudgets((prev) => [created, ...prev]);
      const full = await fetchProjectQuotation(created.id);
      setEditorReadOnly(false);
      setEditorQuotation(full);
      setBudgetIdInUrl(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetImportError'));
    } finally {
      setBusyId(null);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleDuplicate = async (row: ProjectQuotation) => {
    if (!username || !canEditQuotations) return;
    setBusyId(row.id);
    setError('');
    try {
      const created = await duplicateProjectQuotation(row.id, username);
      setBudgets((prev) => [created, ...prev]);
      const full = await fetchProjectQuotation(created.id);
      setEditorReadOnly(false);
      setEditorQuotation(full);
      setBudgetIdInUrl(created.id);
      deepLinkOpenedBudgetRef.current = created.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetDuplicateError'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (row: ProjectQuotation) => {
    if (!canEditQuotations) return;
    if (!window.confirm(t('quotations.budgetDeleteConfirm'))) return;
    setBusyId(row.id);
    setError('');
    try {
      await deleteProjectQuotation(row.id);
      setBudgets((prev) => prev.filter((b) => b.id !== row.id));
      if (urlBudgetId === row.id) setBudgetIdInUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('quotations.budgetDeleteError'));
    } finally {
      setBusyId(null);
    }
  };

  const copyBudgetLink = async (row: ProjectQuotation) => {
    setShareNotice('');
    const url = quotationBudgetShareUrl(row.id);
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice(t('quotations.budgetShareCopied'));
    } catch {
      setShareNotice(url);
    }
  };

  const grandTotalFor = (row: ProjectQuotation) => {
    const lines = row.lines ?? [];
    const rate = row.contingency_rate ?? 0.075;
    const computed = recomputeQuotationLines(
      lines.map((line) => ({ ...line })),
      rate,
    );
    return computed.find((line) => line.summary_key === 'grand_total')?.total ?? null;
  };

  return (
    <>
      <section className="tb-remote-inst-card p-6 md:p-8 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
          <div>
            <h2 className="tb-heading text-lg">{t('quotations.budgetHeading')}</h2>
          </div>
          {canEditQuotations ? (
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <label className="text-xs tb-muted">
                {t('task.project')}
                <select
                  value={creatingProjectId}
                  onChange={(e) => setCreatingProjectId(e.target.value)}
                  className="field-input mt-1 block min-w-[11rem]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="tb-btn-secondary text-sm inline-flex items-center gap-2"
                disabled={!username || !creatingProjectId || busyId === 'create'}
                onClick={() => void createNewBudget()}
              >
                <Plus size={16} aria-hidden />
                {t('quotations.createNew')}
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImportFile(file);
                }}
              />
              <button
                type="button"
                className="tb-btn-secondary text-sm inline-flex items-center gap-2"
                disabled={!username || !creatingProjectId || busyId === 'import'}
                onClick={() => importInputRef.current?.click()}
              >
                <FileSpreadsheet size={16} aria-hidden />
                {t('quotations.importExcel')}
              </button>
            </div>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600 mb-3">{error}</p> : null}
        {shareNotice ? <p className="text-sm text-[var(--tb-accent)] mb-3">{shareNotice}</p> : null}
        {loading ? <p className="text-sm tb-muted">{t('common.loading')}</p> : null}

        {!loading && budgets.length === 0 ? (
          <p className="text-sm tb-muted">{t('quotations.budgetEmpty')}</p>
        ) : null}

        {!loading && budgets.length > 0 ? (
          <ul className="space-y-2">
            {budgets.map((row) => {
              const total = grandTotalFor(row);
              const busy = busyId === row.id;
              return (
                <li
                  key={row.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-[var(--tb-border)] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tb-text truncate">
                      {row.title.trim() || t('quotations.budgetTitlePlaceholder')}
                    </p>
                    <p className="text-xs tb-muted truncate">
                      {row.project?.name ?? t('task.project')} ·{' '}
                      {total != null
                        ? formatQuotationMoney(total, row.currency)
                        : t('quotations.totalPending')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <button
                      type="button"
                      className="tb-btn-secondary p-2"
                      disabled={busy}
                      onClick={() => void copyBudgetLink(row)}
                      aria-label={t('quotations.budgetShare')}
                      title={t('quotations.budgetShare')}
                    >
                      <Link2 size={16} aria-hidden />
                    </button>
                    {canEditQuotations ? (
                      <>
                        <button
                          type="button"
                          className="tb-btn-secondary text-sm inline-flex items-center gap-1.5"
                          disabled={busy}
                          onClick={() => void handleDuplicate(row)}
                          title={t('quotations.budgetDuplicateHint')}
                        >
                          <Copy size={14} aria-hidden />
                          {t('quotations.budgetDuplicate')}
                        </button>
                        <button
                          type="button"
                          className="tb-btn-secondary text-sm inline-flex items-center gap-1.5"
                          disabled={busy}
                          onClick={() => void openEditor(row.id, false)}
                        >
                          <Pencil size={14} aria-hidden />
                          {t('common.edit')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="tb-btn-secondary text-sm inline-flex items-center gap-1.5"
                        disabled={busy}
                        onClick={() => void openEditor(row.id, true)}
                      >
                        <Eye size={14} aria-hidden />
                        {t('quotations.viewBudget')}
                      </button>
                    )}
                    {canEditQuotations ? (
                      <button
                        type="button"
                        className="tb-btn-secondary text-sm inline-flex items-center gap-1.5 text-red-700"
                        disabled={busy}
                        onClick={() => void handleDelete(row)}
                      >
                        <Trash2 size={14} aria-hidden />
                        {t('common.delete')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {editorQuotation ? (
        <QuotationBudgetEditor
          quotation={editorQuotation}
          projects={projects}
          readOnly={editorReadOnly}
          onClose={closeEditor}
          onSaved={(updated) => {
            setBudgets((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
          }}
        />
      ) : null}
    </>
  );
}
