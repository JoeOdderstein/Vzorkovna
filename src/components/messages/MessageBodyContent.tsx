import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
  htmlMessageHasContent,
  isLikelyHtmlMessageBody,
  resolveMessageBodyHtml,
} from '../../lib/messages/messageRichText';

interface MessageBodyContentProps {
  body: string;
  className?: string;
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

function MessageBodyContent({ body, className = 'text-sm break-words' }: MessageBodyContentProps) {
  const { t } = useTaskboardI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const resolvedForBodyRef = useRef<string | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [slides, setSlides] = useState<MessageImageSlide[]>([]);

  useEffect(() => {
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
  }, [body]);

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
    if (!root || !html) return;

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
  }, [html, openLightbox, t]);

  const activeSlide = lightboxIndex != null ? slides[lightboxIndex] : null;

  if (html) {
    return (
      <>
        <div
          ref={containerRef}
          className={`message-rich-text ${className}`}
          dangerouslySetInnerHTML={{ __html: html }}
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
    return <p className={`text-sm tb-muted ${className}`}>…</p>;
  }

  return <p className={`whitespace-pre-wrap ${className}`}>{body}</p>;
}

export default memo(MessageBodyContent);
