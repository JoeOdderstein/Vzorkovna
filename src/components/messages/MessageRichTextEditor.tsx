import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline } from 'lucide-react';
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
  showFormattingToolbar?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

type FormatCommand = 'bold' | 'italic' | 'underline';

const FORMAT_TAGS: Record<FormatCommand, string[]> = {
  bold: ['b', 'strong'],
  italic: ['i', 'em'],
  underline: ['u'],
};

function elementHasBoldStyle(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') return true;
  const fw = el.style.fontWeight;
  if (fw === 'bold' || fw === 'bolder') return true;
  const n = Number.parseInt(fw, 10);
  return !Number.isNaN(n) && n >= 600;
}

function elementHasItalicStyle(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'i' || tag === 'em') return true;
  return el.style.fontStyle === 'italic';
}

function elementHasUnderlineStyle(el: HTMLElement): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'u') return true;
  const line = el.style.textDecorationLine;
  const deco = el.style.textDecoration;
  return line.includes('underline') || deco.includes('underline');
}

function elementHasFormat(el: HTMLElement, command: FormatCommand): boolean {
  if (command === 'bold') return elementHasBoldStyle(el);
  if (command === 'italic') return elementHasItalicStyle(el);
  return elementHasUnderlineStyle(el);
}

function fragmentHasInlineFormat(fragment: DocumentFragment, command: FormatCommand): boolean {
  const tags = FORMAT_TAGS[command].join(',');
  if (fragment.querySelector(tags)) return true;
  const elements = fragment.querySelectorAll('*');
  for (const node of elements) {
    if (node instanceof HTMLElement && elementHasFormat(node, command)) return true;
  }
  return false;
}

function hasMeaningfulEditorContent(editor: HTMLElement): boolean {
  if (editor.querySelector('img')) return true;
  return (editor.textContent ?? '').replace(/\u00a0/g, '').trim().length > 0;
}

/** Browsers keep stale execCommand toggles; clear them when the field is still empty. */
function resetStaleInlineCommandsIfEmpty(editor: HTMLElement): void {
  if (hasMeaningfulEditorContent(editor)) return;
  try {
    document.execCommand('styleWithCSS', false, 'true');
  } catch {
    /* unsupported */
  }
  for (const cmd of ['bold', 'italic', 'underline'] as const) {
    try {
      if (document.queryCommandState(cmd)) {
        document.execCommand(cmd, false);
      }
    } catch {
      /* unsupported */
    }
  }
}

function unwrapEmptyInlineFormatWrappers(editor: HTMLElement): void {
  for (const tag of ['b', 'strong', 'i', 'em', 'u', 'span']) {
    editor.querySelectorAll(tag).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const text = (node.textContent ?? '').replace(/\u00a0/g, '').trim();
      if (text || node.querySelector('img')) return;
      if (tag === 'span' && !node.getAttribute('style')?.trim()) {
        node.replaceWith(...Array.from(node.childNodes));
        return;
      }
      if (tag !== 'span') {
        node.replaceWith(...Array.from(node.childNodes));
      }
    });
  }
}

function normalizeDefaultTypingContext(editor: HTMLElement): void {
  resetStaleInlineCommandsIfEmpty(editor);
  unwrapEmptyInlineFormatWrappers(editor);
}

function isFormatActiveInEditor(editor: HTMLElement, command: FormatCommand): boolean {
  const sel = document.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !editor.contains(sel.anchorNode)) {
    return false;
  }

  const tags = FORMAT_TAGS[command];

  if (!sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    const fragment = range.cloneContents();
    if (fragment.querySelector(tags.join(','))) return true;
    if (fragmentHasInlineFormat(fragment, command)) return true;
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }

  // Collapsed caret: reflect whether the *next* typed characters use this format,
  // not whether the caret sits inside existing bold/italic/underline markup.
  try {
    return document.queryCommandState(command);
  } catch {
    return false;
  }
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
  showFormattingToolbar = true,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: MessageRichTextEditorProps) {
  const { t } = useTaskboardI18n();
  const editorRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef(value);
  const isComposingRef = useRef(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pasteError, setPasteError] = useState('');
  const [formatActive, setFormatActive] = useState({
    bold: false,
    italic: false,
    underline: false,
  });

  const applyEditorHtml = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    try {
      el.innerHTML = plainTextToEditorHtml(html);
      upgradeMessageImagesInEditor(el);
      if (!htmlMessageHasContent(html)) {
        normalizeDefaultTypingContext(el);
      }
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

  const refreshFormatState = useCallback(() => {
    const el = editorRef.current;
    if (!el || disabled) return;

    const activeEl = document.activeElement;
    if (activeEl !== el && !(activeEl instanceof Node && el.contains(activeEl))) {
      setFormatActive({ bold: false, italic: false, underline: false });
      return;
    }

    setFormatActive({
      bold: isFormatActiveInEditor(el, 'bold'),
      italic: isFormatActiveInEditor(el, 'italic'),
      underline: isFormatActiveInEditor(el, 'underline'),
    });
  }, [disabled]);

  useEffect(() => {
    if (!showFormattingToolbar || disabled) return;
    const el = editorRef.current;
    if (!el) return;

    const onSelectionChange = () => refreshFormatState();
    const onBlur = () => {
      setFormatActive({ bold: false, italic: false, underline: false });
    };

    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      el.removeEventListener('blur', onBlur);
      document.removeEventListener('selectionchange', onSelectionChange);
    };
  }, [disabled, refreshFormatState, showFormattingToolbar]);

  const onEditorFocus = () => {
    const el = editorRef.current;
    if (!el || disabled) return;
    normalizeDefaultTypingContext(el);
    refreshFormatState();
  };

  const scheduleRefreshFormatState = useCallback(() => {
    refreshFormatState();
    requestAnimationFrame(() => {
      refreshFormatState();
    });
  }, [refreshFormatState]);

  const onInput = () => {
    if (disabled) return;
    const el = editorRef.current;
    if (el && !hasMeaningfulEditorContent(el)) {
      normalizeDefaultTypingContext(el);
    }
    emitChange();
    scheduleRefreshFormatState();
  };

  const keepEditorSelection = (event: React.MouseEvent) => {
    event.preventDefault();
  };

  const applyFormat = (command: FormatCommand) => {
    const el = editorRef.current;
    if (!el || disabled || uploadingImage) return;
    el.focus();
    try {
      document.execCommand(command, false);
    } catch {
      return;
    }
    scheduleRefreshFormatState();
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
    const el = editorRef.current;
    if (
      el &&
      !disabled &&
      !isComposingRef.current &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      !hasMeaningfulEditorContent(el)
    ) {
      normalizeDefaultTypingContext(el);
    }

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
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onFocus={onEditorFocus}
        onInput={onInput}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onKeyUp={scheduleRefreshFormatState}
        onMouseUp={scheduleRefreshFormatState}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={() => {
          isComposingRef.current = false;
          emitChange();
        }}
        className={`field-input w-full overflow-y-auto overscroll-contain text-sm leading-relaxed outline-none ${minHeightClassName} ${maxHeightClassName} message-rich-text-editor ${showFormattingToolbar ? 'rounded-b-none border-b-0' : ''} ${disabled ? 'opacity-60 pointer-events-none' : ''} ${uploadingImage ? 'opacity-80' : ''}`}
      />
      {showFormattingToolbar ? (
        <div
          className="message-rich-text-format-bar flex items-center gap-0.5 border border-[var(--tb-border)] border-t-0 rounded-b-md bg-[var(--tb-surface)] px-1.5 py-1"
          role="toolbar"
          aria-label={t('messages.formatToolbar')}
        >
          <button
            type="button"
            className={`message-rich-text-format-btn ${formatActive.bold ? 'message-rich-text-format-btn--active' : ''}`}
            aria-label={t('messages.formatBold')}
            aria-pressed={formatActive.bold}
            disabled={disabled || uploadingImage}
            onMouseDown={keepEditorSelection}
            onClick={() => applyFormat('bold')}
          >
            <Bold className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`message-rich-text-format-btn ${formatActive.italic ? 'message-rich-text-format-btn--active' : ''}`}
            aria-label={t('messages.formatItalic')}
            aria-pressed={formatActive.italic}
            disabled={disabled || uploadingImage}
            onMouseDown={keepEditorSelection}
            onClick={() => applyFormat('italic')}
          >
            <Italic className="w-4 h-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`message-rich-text-format-btn ${formatActive.underline ? 'message-rich-text-format-btn--active' : ''}`}
            aria-label={t('messages.formatUnderline')}
            aria-pressed={formatActive.underline}
            disabled={disabled || uploadingImage}
            onMouseDown={keepEditorSelection}
            onClick={() => applyFormat('underline')}
          >
            <Underline className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {uploadingImage ? (
        <p className="text-xs tb-muted mt-1">{t('messages.imageUploading')}</p>
      ) : null}
      {pasteError ? <p className="text-xs text-red-600 mt-1">{pasteError}</p> : null}
    </div>
  );
}

export default memo(MessageRichTextEditor);
