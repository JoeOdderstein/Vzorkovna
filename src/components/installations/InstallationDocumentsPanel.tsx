import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FileText, ImageIcon, Pencil, Upload } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import {
  deleteInstallationDocument,
  getInstallationDocumentUrl,
  installationDocumentPreviewFormat,
  isDocxInstallationDocument,
  isImageInstallationDocument,
  isDocxFile,
  isPdfFile,
  isPdfInstallationDocument,
  isPhotoFile,
  updateInstallationDocumentTitle,
  uploadInstallationDocument,
} from '../../lib/installations/installationDocumentService';
import type { InstallationDocument, InstallationDocumentKind } from '../../lib/installations/types';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import TranslatableText from '../../taskboard/components/TranslatableText';
import InstallationDocxPreview from './InstallationDocxPreview';
import InstallationPdfViewer from './InstallationPdfViewer';
import TaskPhotoLightbox from '../../taskboard/components/TaskPhotoLightbox';

interface InstallationDocumentsPanelProps {
  installationId: string;
  kind: InstallationDocumentKind;
  documents: InstallationDocument[];
  isAdmin: boolean;
  emptyLabel: string;
  uploadLabel: string;
  accept: string;
  pdfKind?: boolean;
  /** Show PDF inline (always visible) instead of opening a fullscreen viewer. */
  embedPdf?: boolean;
  /** Photographs section: images, PDFs, and other files. */
  allowAnyDocuments?: boolean;
  /** Technical section: PDF and Word (.docx). */
  allowDocx?: boolean;
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
  embedPdf = false,
  allowAnyDocuments = false,
  allowDocx = false,
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
  const [embedded, setEmbedded] = useState<{
    url: string;
    title: string;
    docId: string;
    format: 'pdf' | 'docx';
  } | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoLightboxIndex, setPhotoLightboxIndex] = useState<number | null>(null);

  const isPhotoKind = kind === 'photo';

  const previewDocuments = useMemo(() => {
    if (!pdfKind) return [];
    return documents.filter((doc) => {
      if (!doc.storage_path && !doc.external_url) return false;
      return isPdfInstallationDocument(doc) || isDocxInstallationDocument(doc);
    });
  }, [pdfKind, documents]);

  const fileAccept = allowDocx
    ? '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    : accept;

  const imageDocuments = useMemo(
    () => (isPhotoKind ? documents.filter((doc) => isImageInstallationDocument(doc)) : []),
    [isPhotoKind, documents],
  );

  useEffect(() => {
    if (!isPhotoKind) return;
    let cancelled = false;
    for (const doc of imageDocuments) {
      if (!doc.storage_path) continue;
      void getInstallationDocumentUrl(doc.storage_path).then((url) => {
        if (!cancelled) {
          setPhotoUrls((prev) => ({ ...prev, [doc.id]: url }));
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isPhotoKind, imageDocuments]);

  const openPhotoLightbox = useCallback(
    (photoId: string) => {
      const index = imageDocuments.findIndex((doc) => doc.id === photoId);
      if (index >= 0 && photoUrls[photoId]) setPhotoLightboxIndex(index);
    },
    [imageDocuments, photoUrls],
  );

  const previewDocumentsRef = useRef(previewDocuments);
  previewDocumentsRef.current = previewDocuments;

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
      const title = doc.title || t('projects.tech.defaultViewerTitle');
      const embedFormat = installationDocumentPreviewFormat(doc);
      if (pdfKind && embedPdf && embedFormat) {
        setEmbedded({ url, title, docId: doc.id, format: embedFormat });
      } else if (pdfKind && embedPdf && doc.external_url) {
        setEmbedded({
          url: doc.external_url,
          title,
          docId: doc.id,
          format: 'pdf',
        });
      } else if (pdfKind && isPdfInstallationDocument(doc)) {
        setViewer({ url, title });
      } else if (pdfKind) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (isPhotoKind && isPdfInstallationDocument(doc)) {
        setViewer({ url, title });
      } else if (isPhotoKind && isImageInstallationDocument(doc)) {
        setPhotoUrls((prev) => ({ ...prev, [doc.id]: url }));
        const index = imageDocuments.findIndex((d) => d.id === doc.id);
        if (index >= 0) setPhotoLightboxIndex(index);
      } else if (isPhotoKind) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      setError(t('projects.tech.openError'));
    } finally {
      setOpeningId(null);
    }
  };

  const preferredEmbedDocId = useMemo(() => {
    if (!embedPdf || !pdfKind || previewDocuments.length === 0) return null;
    const preferred =
      previewDocuments.find((doc) => doc.storage_path && isPdfInstallationDocument(doc)) ??
      previewDocuments.find((doc) => doc.storage_path && isDocxInstallationDocument(doc)) ??
      previewDocuments.find((doc) => doc.external_url && isPdfInstallationDocument(doc));
    return preferred?.id ?? null;
  }, [embedPdf, pdfKind, previewDocuments]);

  useEffect(() => {
    if (!embedPdf || !pdfKind) return;

    if (!preferredEmbedDocId) {
      setEmbedded(null);
      return;
    }

    if (embedded?.docId === preferredEmbedDocId) return;

    const preferred = previewDocumentsRef.current.find((doc) => doc.id === preferredEmbedDocId);
    if (!preferred) return;

    const format = installationDocumentPreviewFormat(preferred);
    if (!format && !preferred.external_url) return;

    let cancelled = false;
    setOpeningId(preferred.id);
    setError('');

    const finishOpening = () => {
      if (!cancelled) setOpeningId(null);
    };

    const title = preferred.title || t('projects.tech.defaultViewerTitle');

    if (preferred.external_url && !preferred.storage_path) {
      setEmbedded({
        url: preferred.external_url,
        title,
        docId: preferred.id,
        format: format ?? 'pdf',
      });
      finishOpening();
      return () => {
        cancelled = true;
      };
    }

    if (!preferred.storage_path || !format) {
      finishOpening();
      return () => {
        cancelled = true;
      };
    }

    void getInstallationDocumentUrl(preferred.storage_path)
      .then((url) => {
        if (cancelled) return;
        setEmbedded({ url, title, docId: preferred.id, format });
      })
      .catch(() => {
        if (!cancelled) setError(t('projects.tech.openError'));
      })
      .finally(finishOpening);

    return () => {
      cancelled = true;
      finishOpening();
    };
  }, [embedPdf, pdfKind, preferredEmbedDocId, embedded?.docId, t]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        if (pdfKind && allowDocx && !isPdfFile(file) && !isDocxFile(file)) {
          throw new Error(t('projects.tech.pdfOrDocxOnly'));
        }
        if (pdfKind && !allowDocx && !isPdfFile(file)) {
          throw new Error(t('projects.tech.pdfOnly'));
        }
        if (!pdfKind && !allowAnyDocuments && !isPhotoFile(file)) {
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

  const canEmbedPdf = embedPdf && previewDocuments.some((doc) => doc.storage_path);

  const photoLightboxDoc =
    photoLightboxIndex != null &&
    photoLightboxIndex >= 0 &&
    photoLightboxIndex < imageDocuments.length
      ? imageDocuments[photoLightboxIndex]
      : null;
  const photoLightboxUrl = photoLightboxDoc ? photoUrls[photoLightboxDoc.id] : null;

  const documentListRow = (doc: InstallationDocument) => (
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
            className={`inline-flex items-center gap-2 text-sm disabled:opacity-50 text-left min-w-0 flex-1 ${
              embedPdf && embedded?.docId === doc.id
                ? 'text-[var(--tb-accent)] font-medium'
                : 'tb-text hover:text-[var(--tb-accent)]'
            }`}
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
  );

  const documentList =
    documents.length === 0 && !isAdmin ? (
      <p className="text-sm tb-muted">{emptyLabel}</p>
    ) : isPhotoKind ? (
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-3 list-none m-0 p-0 max-w-xl">
        {documents.map((doc) => {
          const previewUrl = photoUrls[doc.id];
          const isImage = isImageInstallationDocument(doc);
          const isPdf = isPdfInstallationDocument(doc);
          const title = doc.title ? (
            <TranslatableText text={doc.title} />
          ) : (
            t('projects.tech.defaultDoc')
          );

          if (editingId === doc.id) {
            return (
              <li key={doc.id} className="col-span-full flex flex-wrap items-center gap-2">
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
              </li>
            );
          }

          return (
            <li key={doc.id} className="flex min-w-0 flex-col gap-1.5">
              {isImage && previewUrl ? (
                <button
                  type="button"
                  onClick={() => openPhotoLightbox(doc.id)}
                  className="group relative aspect-square w-full max-w-[6.5rem] overflow-hidden rounded-lg border border-[var(--tb-border)] bg-[var(--tb-bg)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tb-accent)]"
                  title={doc.title || t('projects.tech.defaultDoc')}
                >
                  <img
                    src={previewUrl}
                    alt={doc.title || t('projects.tech.defaultDoc')}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    {t('projects.tech.viewPhoto')}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void openDocument(doc)}
                  disabled={openingId === doc.id || (!doc.storage_path && !doc.external_url)}
                  className="flex aspect-square w-full max-w-[6.5rem] flex-col items-center justify-center gap-1 rounded-lg border border-[var(--tb-border)] bg-[var(--tb-surface)] px-1 text-[var(--tb-muted)] disabled:opacity-50"
                  title={doc.title || t('projects.tech.defaultDoc')}
                >
                  {openingId === doc.id ? (
                    <span className="text-[10px] px-1 text-center">{t('projects.tech.opening')}</span>
                  ) : isPdf ? (
                    <>
                      <FileText size={22} aria-hidden />
                      <span className="text-[9px] font-medium uppercase tracking-wide">PDF</span>
                    </>
                  ) : isImage ? (
                    <ImageIcon size={22} aria-hidden />
                  ) : (
                    <>
                      <FileText size={22} aria-hidden />
                      <span className="text-[9px] font-medium uppercase tracking-wide">Doc</span>
                    </>
                  )}
                </button>
              )}
              <span className="max-w-[6.5rem] truncate text-xs tb-muted" title={doc.title}>
                {title}
              </span>
              {isAdmin ? (
                <div className="flex max-w-[6.5rem] flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => startEditTitle(doc)}
                    className="text-[10px] tb-btn-secondary inline-flex items-center gap-0.5 px-1.5 py-0.5"
                    aria-label={t('projects.admin.edit')}
                  >
                    <Pencil size={10} />
                    {t('projects.admin.edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRemove(doc)}
                    disabled={removingId === doc.id}
                    className="text-[10px] text-red-600 hover:text-red-800 disabled:opacity-50"
                  >
                    {removingId === doc.id ? t('projects.tech.removing') : t('common.remove')}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    ) : (
      <ul className="space-y-2">{documents.map((doc) => documentListRow(doc))}</ul>
    );

  const adminUpload = isAdmin ? (
    <div className="mt-4 space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={fileAccept}
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
      {allowDocx ? (
        <p className="text-xs tb-muted max-w-md">{t('projects.tech.uploadHint')}</p>
      ) : null}
    </div>
  ) : null;

  const embeddedPdf = canEmbedPdf ? (
    <div className="rounded-lg border border-[var(--tb-border)] overflow-hidden bg-[var(--tb-bg)]">
      {embedded?.format === 'pdf' ? (
        <iframe
          title={embedded.title}
          src={embedded.url}
          className="w-full min-h-[min(72vh,40rem)] border-0 bg-white"
        />
      ) : embedded?.format === 'docx' ? (
        <InstallationDocxPreview documentUrl={embedded.url} />
      ) : (
        <p className="px-3 py-8 text-sm tb-muted text-center">
          {openingId ? t('projects.tech.opening') : t('common.loading')}
        </p>
      )}
    </div>
  ) : null;

  return (
    <>
      {embedPdf ? embeddedPdf : null}

      <div className={embedPdf && canEmbedPdf ? 'mt-4 space-y-0' : undefined}>
        {documentList}
        {adminUpload}
      </div>

      {error ? <p className="text-sm text-red-600 mt-3">{error}</p> : null}

      {viewer ? (
        <InstallationPdfViewer
          pdfUrl={viewer.url}
          title={viewer.title}
          onClose={() => setViewer(null)}
        />
      ) : null}

      {photoLightboxDoc && photoLightboxUrl ? (
        <TaskPhotoLightbox
          imageUrl={photoLightboxUrl}
          fileName={photoLightboxDoc.title || t('projects.tech.defaultDoc')}
          onClose={() => setPhotoLightboxIndex(null)}
          hasPrevious={photoLightboxIndex != null && photoLightboxIndex > 0}
          hasNext={photoLightboxIndex != null && photoLightboxIndex < imageDocuments.length - 1}
          onPrevious={() =>
            setPhotoLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i))
          }
          onNext={() =>
            setPhotoLightboxIndex((i) =>
              i != null && i < imageDocuments.length - 1 ? i + 1 : i,
            )
          }
        />
      ) : null}
    </>
  );
}
