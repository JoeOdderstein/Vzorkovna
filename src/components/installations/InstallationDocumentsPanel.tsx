import { useRef, useState } from 'react';
import { FileText, Pencil, Upload } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  deleteInstallationDocument,
  getInstallationDocumentUrl,
  isPdfFile,
  isPhotoFile,
  updateInstallationDocumentTitle,
  uploadInstallationDocument,
} from '../../lib/installations/installationDocumentService';
import type { InstallationDocument, InstallationDocumentKind } from '../../lib/installations/types';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import TranslatableText from '../../taskboard/components/TranslatableText';
import InstallationPdfViewer from './InstallationPdfViewer';

interface InstallationDocumentsPanelProps {
  installationId: string;
  kind: InstallationDocumentKind;
  documents: InstallationDocument[];
  isAdmin: boolean;
  emptyLabel: string;
  uploadLabel: string;
  accept: string;
  pdfKind?: boolean;
}

export default function InstallationDocumentsPanel({
  installationId,
  kind,
  documents,
  isAdmin,
  emptyLabel,
  uploadLabel,
  accept,
  pdfKind = false,
}: InstallationDocumentsPanelProps) {
  const { t } = useTaskboardI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [error, setError] = useState('');
  const [viewer, setViewer] = useState<{ url: string; title: string } | null>(null);

  const openDocument = async (doc: InstallationDocument) => {
    if (!doc.storage_path) {
      if (doc.external_url) {
        window.open(doc.external_url, '_blank', 'noopener,noreferrer');
      }
      return;
    }

    setOpeningId(doc.id);
    setError('');
    try {
      const url = await getInstallationDocumentUrl(doc.storage_path);
      if (pdfKind) {
        setViewer({ url, title: doc.title || t('projects.tech.defaultViewerTitle') });
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError(t('projects.tech.openError'));
    } finally {
      setOpeningId(null);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        if (pdfKind && !isPdfFile(file)) {
          throw new Error(t('projects.tech.pdfOnly'));
        }
        if (!pdfKind && !isPhotoFile(file)) {
          throw new Error(t('projects.admin.photoOnly'));
        }
        await uploadInstallationDocument(installationId, kind, file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.tech.uploadFailed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const startEditTitle = (doc: InstallationDocument) => {
    setEditingId(doc.id);
    setEditTitle(doc.title);
  };

  const saveTitle = async (doc: InstallationDocument) => {
    setError('');
    try {
      await updateInstallationDocumentTitle(doc.id, editTitle);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.admin.saveError'));
    }
  };

  const handleRemove = async (doc: InstallationDocument) => {
    const label = doc.title || t('projects.tech.defaultDoc');
    if (!window.confirm(formatMessage(t('projects.tech.removeConfirm'), { label }))) return;

    setRemovingId(doc.id);
    setError('');
    try {
      await deleteInstallationDocument(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('projects.tech.removeFailed'));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      {documents.length === 0 && !isAdmin ? (
        <p className="text-sm tb-muted">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--tb-border)] px-3 py-2"
            >
              {editingId === doc.id ? (
                <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="field-input flex-1 min-w-[8rem] text-sm"
                  />
                  <button type="button" className="tb-btn-primary text-xs" onClick={() => void saveTitle(doc)}>
                    {t('common.save')}
                  </button>
                  <button type="button" className="tb-btn-secondary text-xs" onClick={() => setEditingId(null)}>
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void openDocument(doc)}
                    disabled={openingId === doc.id || (!doc.storage_path && !doc.external_url)}
                    className="inline-flex items-center gap-2 text-sm tb-text hover:text-[var(--tb-accent)] disabled:opacity-50 text-left min-w-0 flex-1"
                  >
                    {pdfKind ? <FileText size={16} className="shrink-0 tb-muted" /> : null}
                    <span className="truncate">
                      {doc.title ? (
                        <TranslatableText text={doc.title} />
                      ) : (
                        t('projects.tech.defaultDoc')
                      )}
                    </span>
                    {openingId === doc.id ? (
                      <span className="text-xs tb-muted shrink-0">{t('projects.tech.opening')}</span>
                    ) : null}
                  </button>
                  {isAdmin ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditTitle(doc)}
                        className="text-xs tb-btn-secondary inline-flex items-center gap-1"
                        aria-label={t('projects.admin.edit')}
                      >
                        <Pencil size={12} />
                        {t('projects.admin.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemove(doc)}
                        disabled={removingId === doc.id}
                        className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                      >
                        {removingId === doc.id ? t('projects.tech.removing') : t('common.remove')}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin ? (
        <div className="mt-4">
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple
            className="sr-only"
            onChange={(e) => void handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="tb-btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? t('projects.tech.uploading') : uploadLabel}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}

      {viewer ? (
        <InstallationPdfViewer
          pdfUrl={viewer.url}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </>
  );
}
