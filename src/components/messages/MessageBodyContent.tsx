import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import TaskPhotoLightbox from '../../taskboard/components/TaskPhotoLightbox';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { MESSAGE_FILE_LINK_CLASS } from '../../lib/messages/messageAttachmentHtml';
import { downloadMessageFile } from '../../lib/messages/messageFileService';
import {
  downloadMessageImage,
  messageImageFileNameFromPath,
  messageImageStoragePathFromElement,
} from '../../lib/messages/messageImageService';
import {
  buildLocalFeedSummary,
  fetchMessageFeedSummary,
} from '../../lib/messages/messageFeedSummary';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';
import {
  htmlMessageHasContent,
  isLikelyHtmlMessageBody,
  resolveMessageBodyHtml,
} from '../../lib/messages/messageRichText';
import {
  applyFeedScrollAnchorPin,
  captureFeedScrollAnchorPin,
  scheduleFeedScrollAnchorPin,
  suppressFeedAutoScroll,
  type FeedScrollAnchorPin,
} from '../../lib/messages/messageFeedScrollAnchor';

interface MessageBodyContentProps {
  messageId: string;
  title: string;
  body: string;
  feedSummary?: string | null;
  className?: string;
  onFeedSummaryChange?: (summary: string) => void;
  /** Message title (or row) — kept fixed on screen when expanding at the bottom of the feed. */
  scrollAnchorRef?: RefObject<HTMLElement | null>;
}

type MessageImageSlide = {
  url: string;
  fileName: string;
};

function collectMessageImages(container: HTMLElement): MessageImageSlide[] {
  const slides: MessageImageSlide[] = [];
  for (const img of container.querySelectorAll('img')) {
    if (!(img instanceof HTMLImageElement)) continue;
    const src = img.getAttribute('src')?.trim();
    if (!src) continue;
    const path = messageImageStoragePathFromElement(img);
    const fileName = path ? messageImageFileNameFromPath(path) : 'message-image.png';
    slides.push({ url: src, fileName });
  }
  return slides;
}

function MessageBodyExpandToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTaskboardI18n();
  return (
    <button
      type="button"
      className="mt-2 text-sm font-medium text-[var(--tb-accent)] hover:opacity-85 underline-offset-2 hover:underline"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      {expanded ? t('messages.closeMessage') : t('messages.openMessage')}
    </button>
  );
}

function MessageBodyContent({
  messageId,
  title,
  body,
  feedSummary,
  className = 'text-sm break-words',
  onFeedSummaryChange,
  scrollAnchorRef,
}: MessageBodyContentProps) {
  const { t } = useTaskboardI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedForBodyRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slides, setSlides] = useState<MessageImageSlide[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<string | null>(feedSummary?.trim() || null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const summaryRequestRef = useRef(0);
  const expandScrollPinRef = useRef<FeedScrollAnchorPin | null>(null);

  const setExpandedWithScrollAnchor = useCallback(
    (next: boolean) => {
      if (next) {
        const anchor = scrollAnchorRef?.current;
        if (anchor) {
          const pin = captureFeedScrollAnchorPin(anchor);
          if (pin) {
            expandScrollPinRef.current = pin;
            suppressFeedAutoScroll();
          }
        }
      } else {
        expandScrollPinRef.current = null;
        suppressFeedAutoScroll(600);
      }
      setExpanded(next);
    },
    [scrollAnchorRef]
  );

  useLayoutEffect(() => {
    const pin = expandScrollPinRef.current;
    if (!expanded || !pin) return;
    scheduleFeedScrollAnchorPin(pin);
  }, [expanded, html, body, summaryLoading]);

  const loadSummary = useCallback(
    (force = false) => {
      if (expanded) return;

      const requestId = ++summaryRequestRef.current;
      setSummaryLoading(true);
      setSummaryError('');

      if (isLocalTaskboardMode()) {
        const local = buildLocalFeedSummary(body);
        setSummary(local || null);
        setSummaryLoading(false);
        if (local) onFeedSummaryChange?.(local);
        return;
      }

      if (feedSummary?.trim() && !force) {
        setSummary(feedSummary.trim());
        setSummaryLoading(false);
        return;
      }

      void fetchMessageFeedSummary(messageId, { force })
        .then((text) => {
          if (requestId !== summaryRequestRef.current) return;
          const trimmed = text.trim();
          setSummary(trimmed || null);
          if (trimmed) onFeedSummaryChange?.(trimmed);
        })
        .catch((err) => {
          if (requestId !== summaryRequestRef.current) return;
          setSummary(null);
          setSummaryError(
            err instanceof Error ? err.message : t('messages.feedSummaryError')
          );
        })
        .finally(() => {
          if (requestId === summaryRequestRef.current) {
            setSummaryLoading(false);
          }
        });
    },
    [body, expanded, feedSummary, messageId, onFeedSummaryChange, t]
  );

  useEffect(() => {
    setExpanded(false);
    expandScrollPinRef.current = null;
    setSummary(feedSummary?.trim() || null);
    setSummaryError('');
  }, [body, feedSummary, messageId]);

  useEffect(() => {
    const pin = expandScrollPinRef.current;
    if (!expanded || !pin) return;

    const nodes: HTMLElement[] = [pin.anchorEl];
    const row = pin.anchorEl.closest('li');
    if (row instanceof HTMLElement) nodes.push(row);
    if (containerRef.current) nodes.push(containerRef.current);

    const onResize = () => {
      suppressFeedAutoScroll();
      applyFeedScrollAnchorPin(pin);
    };

    const observer = new ResizeObserver(onResize);
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, html]);

  useEffect(() => {
    if (expanded) return;
    if (feedSummary?.trim()) return;
    loadSummary(false);
  }, [body, expanded, feedSummary, loadSummary, messageId]);

  useEffect(() => {
    if (!expanded) {
      resolvedForBodyRef.current = null;
      setHtml(null);
      return;
    }

    if (!isLikelyHtmlMessageBody(body)) {
      resolvedForBodyRef.current = null;
      setHtml(null);
      return;
    }

    let cancelled = false;
    if (resolvedForBodyRef.current !== body) {
      setHtml(null);
    }
    void resolveMessageBodyHtml(body).then((resolved) => {
      if (cancelled) return;
      if (htmlMessageHasContent(resolved) || htmlMessageHasContent(body)) {
        resolvedForBodyRef.current = body;
        setHtml(resolved);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [body, expanded]);

  const openLightbox = useCallback((index: number, list: MessageImageSlide[]) => {
    if (index < 0 || index >= list.length) return;
    setSlides(list);
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !html || !expanded) return;

    const onRootClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const fileLink = target.closest(`a.${MESSAGE_FILE_LINK_CLASS}`);
      if (fileLink && root.contains(fileLink)) {
        const path = fileLink.getAttribute('data-storage-path')?.trim();
        const name = fileLink.getAttribute('data-file-name')?.trim() || 'file';
        if (path) {
          event.preventDefault();
          void downloadMessageFile(path, name).catch(() => {});
        }
        return;
      }
      if (!(target instanceof HTMLImageElement)) return;
      if (!root.contains(target)) return;
      const src = target.getAttribute('src')?.trim();
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      const list = collectMessageImages(root);
      const index = list.findIndex((slide) => slide.url === src);
      openLightbox(index >= 0 ? index : 0, list.length > 0 ? list : [{ url: src, fileName: 'message-image.png' }]);
    };

    const images = root.querySelectorAll('img');
    for (const img of images) {
      img.classList.add('message-inline-image--viewable');
      img.setAttribute('role', 'button');
      img.setAttribute('tabindex', '0');
      img.setAttribute('aria-label', t('messages.imageViewLarger'));
    }

    root.addEventListener('click', onRootClick);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target;
      if (!(target instanceof HTMLImageElement) || !root.contains(target)) return;
      event.preventDefault();
      onRootClick(event);
    };
    root.addEventListener('keydown', onKeyDown);

    return () => {
      root.removeEventListener('click', onRootClick);
      root.removeEventListener('keydown', onKeyDown);
    };
  }, [expanded, html, openLightbox, t]);

  const activeSlide = lightboxIndex != null ? slides[lightboxIndex] : null;

  if (!expanded) {
    return (
      <>
        {summaryLoading ? (
          <p className={`text-sm tb-muted ${className}`}>{t('messages.feedSummaryLoading')}</p>
        ) : summary ? (
          <p className={`text-sm leading-relaxed ${className}`}>
            <span className="font-semibold text-[var(--tb-text-secondary)]">
              {t('messages.feedSummaryLabel')}
            </span>{' '}
            {summary}
          </p>
        ) : summaryError ? (
          <div className="space-y-2">
            <p className={`text-sm text-red-600 ${className}`}>{summaryError}</p>
            <button
              type="button"
              className="text-sm font-medium text-[var(--tb-accent)] hover:underline"
              onClick={() => loadSummary(true)}
            >
              {t('messages.feedSummaryRetry')}
            </button>
          </div>
        ) : (
          <p className={`text-sm tb-muted ${className}`}>{t('messages.feedSummaryUnavailable')}</p>
        )}
        <MessageBodyExpandToggle
          expanded={false}
          onToggle={() => setExpandedWithScrollAnchor(true)}
        />
      </>
    );
  }

  if (html) {
    return (
      <>
        <div
          ref={containerRef}
          className={`message-rich-text ${className}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <MessageBodyExpandToggle
          expanded
          onToggle={() => setExpandedWithScrollAnchor(false)}
        />
        {activeSlide ? (
          <TaskPhotoLightbox
            imageUrl={activeSlide.url}
            fileName={activeSlide.fileName}
            onClose={closeLightbox}
            hasPrevious={lightboxIndex != null && lightboxIndex > 0}
            hasNext={lightboxIndex != null && lightboxIndex < slides.length - 1}
            onPrevious={() =>
              setLightboxIndex((i) => (i != null && i > 0 ? i - 1 : i))
            }
            onNext={() =>
              setLightboxIndex((i) =>
                i != null && i < slides.length - 1 ? i + 1 : i
              )
            }
            downloadLabel={t('messages.imageDownload')}
            onDownload={() =>
              downloadMessageImage(activeSlide.url, activeSlide.fileName)
            }
          />
        ) : null}
      </>
    );
  }

  if (isLikelyHtmlMessageBody(body) && html === null) {
    return (
      <>
        <p className={`text-sm tb-muted ${className}`}>…</p>
        <MessageBodyExpandToggle
          expanded
          onToggle={() => setExpandedWithScrollAnchor(false)}
        />
      </>
    );
  }

  return (
    <>
      <p className={`whitespace-pre-wrap ${className}`}>{body}</p>
      <MessageBodyExpandToggle
        expanded
        onToggle={() => setExpandedWithScrollAnchor(false)}
      />
    </>
  );
}

export default memo(MessageBodyContent);
