import { useRef, useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import InstallationPdfViewer from './InstallationPdfViewer';
import {
  deleteInstallationDocument,
  getInstallationDocumentUrl,
  isPdfFile,
  uploadTechnicalPdf,
} from '../../lib/installations/installationDocumentService';
import type { InstallationDocument } from '../../lib/installations/types';

interface TechnicalDocumentationSectionProps {
  installationId: string;
  documents: InstallationDocument[];
  isAdmin: boolean;
}

export default function TechnicalDocumentationSection({
  installationId,
  documents,
  isAdmin,
}: TechnicalDocumentationSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
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
      setViewer({ url, title: doc.title || 'Technical document' });
    } catch {
      setError('Could not open this PDF. Try again.');
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
        if (!isPdfFile(file)) {
          throw new Error('Only PDF files can be uploaded here.');
        }
        await uploadTechnicalPdf(installationId, file);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async (doc: InstallationDocument) => {
    const label = doc.title || 'this document';
    if (!window.confirm(`Remove "${label}" from technical documentation?`)) return;

    setRemovingId(doc.id);
    setError('');
    try {
      await deleteInstallationDocument(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove document.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <>
      {documents.length === 0 && !isAdmin ? (
        <p className="text-sm tb-muted">No technical documents on file yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--tb-border)] px-3 py-2"
            >
              <button
                type="button"
                onClick={() => openDocument(doc)}
                disabled={openingId === doc.id || (!doc.storage_path && !doc.external_url)}
                className="inline-flex items-center gap-2 text-sm tb-text hover:text-[var(--tb-accent)] disabled:opacity-50 text-left min-w-0"
              >
                <FileText size={16} className="shrink-0 tb-muted" />
                <span className="truncate">{doc.title || 'Document'}</span>
                {openingId === doc.id ? (
                  <span className="text-xs tb-muted shrink-0">Opening…</span>
                ) : null}
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => handleRemove(doc)}
                  disabled={removingId === doc.id}
                  className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50 shrink-0"
                >
                  {removingId === doc.id ? 'Removing…' : 'Remove'}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {isAdmin ? (
        <div className="mt-4 pt-4 border-t border-[var(--tb-border)]">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="sr-only"
            onChange={(e) => handleUpload(e.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="tb-btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Upload size={16} />
            {uploading ? 'Uploading…' : 'Upload PDF'}
          </button>
          <p className="text-xs tb-muted mt-2">PDF only, up to 25 MB. Team members can open files here in the browser.</p>
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
