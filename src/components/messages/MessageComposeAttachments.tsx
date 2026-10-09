import { useRef, useState } from 'react';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { formatMessage } from '../../lib/taskboard/i18n/messages';
import {
  formatMessageFileSize,
  MAX_MESSAGE_FILE_BYTES,
  uploadMessageFile,
} from '../../lib/messages/messageFileService';

import type { MessageComposeAttachment } from '../../lib/messages/types';

interface MessageComposeAttachmentsProps {
  username: string;
  attachments: MessageComposeAttachment[];
  onChange: (next: MessageComposeAttachment[]) => void;
  disabled?: boolean;
}

export default function MessageComposeAttachments({
  username,
  attachments,
  onChange,
  disabled = false,
}: MessageComposeAttachmentsProps) {
  const { t } = useTaskboardI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onPickFiles = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const onFilesSelected = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError('');
    setUploading(true);
    try {
      const added: MessageComposeAttachment[] = [];
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_MESSAGE_FILE_BYTES) {
          throw new Error(t('messages.attachFileTooLarge'));
        }
        const { storagePath, fileName } = await uploadMessageFile(file, username);
        added.push({
          id: crypto.randomUUID(),
          fileName,
          storagePath,
          size: file.size,
          contentType: file.type,
        });
      }
      onChange([...attachments, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('messages.attachUploadError'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    onChange(attachments.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="tb-field-label text-sm">{t('messages.attachFiles')}</span>
        <button
          type="button"
          className="tb-btn-secondary !text-xs !px-2 !py-1 inline-flex items-center gap-1 min-h-0"
          onClick={onPickFiles}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="w-3 h-3" aria-hidden />
          )}
          {uploading ? t('messages.attachUploading') : t('messages.attachFilesChoose')}
        </button>
      </div>
      <p className="text-xs tb-muted">{t('messages.attachFilesHint')}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => void onFilesSelected(e.target.files)}
      />
      {attachments.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-[var(--tb-border)] p-2">
          {attachments.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 text-sm min-w-0 py-0.5 px-1 rounded hover:bg-[var(--tb-surface)]"
            >
              <Paperclip className="w-3.5 h-3.5 shrink-0 tb-muted" aria-hidden />
              <span className="truncate flex-1 min-w-0" title={file.fileName}>
                {file.fileName}
              </span>
              <span className="text-xs tb-muted shrink-0">{formatMessageFileSize(file.size)}</span>
              <button
                type="button"
                className="shrink-0 p-1 text-[var(--tb-text-muted)] hover:text-red-600 rounded"
                onClick={() => removeAttachment(file.id)}
                disabled={disabled || uploading}
                aria-label={formatMessage(t('messages.attachRemove'), { name: file.fileName })}
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
