import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { uploadMessageImage } from '../../lib/messages/messageImageService';
import {
  applyDefaultInlineImageSize,
  attachMessageImageEditorListeners,
  insertImageAtCaret,
  upgradeMessageImagesInEditor,
  unwrapMessageImageBlocksForSave,
} from '../../lib/messages/messageEditorImageInteractions';
import {
  htmlMessageHasContent,
  messageBodyToPlainText,
  plainTextToEditorHtml,
  sanitizeMessageHtml,
} from '../../lib/messages/messageRichText';

interface MessageRichTextEditorProps {
  username: string;
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeightClassName?: string;
  maxHeightClassName?: string;
  onEnterSubmit?: () => void;
  enterSubmits?: boolean;
  'aria-label'?: string;
}

function MessageRichTextEditor({
  username,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = '',
  minHeightClassName = 'min-h-[6rem]',
  maxHeightClassName = 'max-h-[min(16rem,38vh)]',
  onEnterSubmit,
  enterSubmits = false,
  'aria-label': ariaLabel,
}: MessageRichTextEditorProps) {
  const { t } = useTaskboardI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const isComposingRef = useRef(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pasteError, setPasteError] = useState('');

  const applyEditorHtml = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    try {
      el.innerHTML = plainTextToEditorHtml(html);
      upgradeMessageImagesInEditor(el);
    } catch (err) {
      console.error('MessageRichTextEditor: apply html failed', err);
      const fallback = messageBodyToPlainText(html);
      el.textContent = fallback;
    }
  }, []);

  useLayoutEffect(() => {
    applyEditorHtml(value);
    lastEmittedRef.current = value;
  }, []);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    applyEditorHtml(value);
    lastEmittedRef.current = value;
  }, [value, applyEditorHtml]);

  const imageToolbarLabelsRef = useRef({
    resize: t('messages.imageToolbarResize'),
    delete: t('messages.imageToolbarDelete'),
  });
  imageToolbarLabelsRef.current = {
    resize: t('messages.imageToolbarResize'),
    delete: t('messages.imageToolbarDelete'),
  };

  const emitChange = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    let raw = '';
    try {
      raw = unwrapMessageImageBlocksForSave(el);
    } catch (err) {
      console.error('MessageRichTextEditor: serialize failed', err);
      raw = el.innerHTML;
    }
    if (!htmlMessageHasContent(raw)) {
      if (el.innerHTML !== '') el.innerHTML = '';
      lastEmittedRef.current = '';
      onChange('');
      return;
    }
    lastEmittedRef.current = raw;
    onChange(raw);
  }, [onChange]);

  const editorOptionsRef = useRef({
    disabled: false,
    uploadingImage: false,
  });
  editorOptionsRef.current = { disabled, uploadingImage };

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    return attachMessageImageEditorListeners(el, {
      onUpdate: emitChange,
      isDisabled: () =>
        editorOptionsRef.current.disabled || editorOptionsRef.current.uploadingImage,
      labels: imageToolbarLabelsRef.current,
    });
  }, [emitChange]);

  const insertImageHtml = useCallback(
    (storagePath: string, previewUrl: string) => {
      const el = editorRef.current;
      if (!el) return;
      const img = document.createElement('img');
      img.className = 'message-inline-image';
      img.setAttribute('data-storage-path', storagePath);
      img.src = previewUrl;
      img.alt = '';
      img.loading = 'lazy';
      insertImageAtCaret(el, img);
      upgradeMessageImagesInEditor(el);
      const applySize = () => {
        const inEditor =
          el.querySelector(`img[data-storage-path="${CSS.escape(storagePath)}"]`) ?? img;
        if (inEditor instanceof HTMLImageElement) {
          applyDefaultInlineImageSize(inEditor, el);
        }
      };
      applySize();
      requestAnimationFrame(applySize);
      emitChange();
      img.addEventListener(
        'load',
        () => {
          applySize();
          emitChange();
        },
        { once: true }
      );
    },
    [emitChange]
  );

  const onInput = () => {
    if (disabled) return;
    emitChange();
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled || uploadingImage) return;

    const imageItem = Array.from(e.clipboardData.items).find((item) =>
      item.type.startsWith('image/')
    );
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file || !username.trim()) return;
      setPasteError('');
      setUploadingImage(true);
      void uploadMessageImage(file, username)
        .then(({ storagePath, previewUrl }) => {
          insertImageHtml(storagePath, previewUrl);
        })
        .catch((err) => {
          setPasteError(err instanceof Error ? err.message : t('messages.imagePasteError'));
        })
        .finally(() => {
          setUploadingImage(false);
        });
      return;
    }

    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    if (!html && plain) {
      e.preventDefault();
      const text = plain.replace(/\r\n/g, '\n');
      document.execCommand('insertText', false, text);
      emitChange();
      return;
    }
    if (html) {
      e.preventDefault();
      const clean = sanitizeMessageHtml(html);
      if (clean) {
        document.execCommand('insertHTML', false, clean);
        const el = editorRef.current;
        if (el) upgradeMessageImagesInEditor(el);
        emitChange();
      }
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || !enterSubmits || e.key !== 'Enter' || e.shiftKey || isComposingRef.current) {
      return;
    }
    e.preventDefault();
    onEnterSubmit?.();
  };

  const showPlaceholder = !htmlMessageHasContent(value);

  return (
    <div className={`relative ${className}`}>
      {showPlaceholder && placeholder ? (
        <span
          className="pointer-events-none absolute left-3 top-2.5 text-sm text-[var(--tb-muted)] opacity-70"
          aria-hidden
        >
          {placeholder}
        </span>
      ) : null}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          emitChange();
        }}
        className={`field-input w-full overflow-y-auto overscroll-contain text-sm leading-relaxed outline-none ${minHeightClassName} ${maxHeightClassName} message-rich-text-editor ${disabled ? 'opacity-60 pointer-events-none' : ''} ${uploadingImage ? 'opacity-80' : ''}`}
      />
      {uploadingImage ? (
        <p className="text-xs tb-muted mt-1">{t('messages.imageUploading')}</p>
      ) : null}
      {pasteError ? <p className="text-xs text-red-600 mt-1">{pasteError}</p> : null}
    </div>
  );
}

export default memo(MessageRichTextEditor);
