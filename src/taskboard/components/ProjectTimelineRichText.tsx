import { useEffect, useState } from 'react';
import {
  htmlMessageHasContent,
  plainTextToEditorHtml,
  resolveMessageBodyHtml,
  sanitizeMessageHtml,
} from '../../lib/messages/messageRichText';

type ProjectTimelineRichTextProps = {
  body: string;
  className?: string;
  emptyClassName?: string;
};

/** Read-only timeline name/description (same styling as message board). */
export default function ProjectTimelineRichText({
  body,
  className = '',
  emptyClassName = 'tb-muted',
}: ProjectTimelineRichTextProps) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!htmlMessageHasContent(body)) {
      setHtml('');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resolved = await resolveMessageBodyHtml(body);
        const display = resolved || sanitizeMessageHtml(plainTextToEditorHtml(body));
        if (!cancelled) setHtml(display);
      } catch {
        if (!cancelled) {
          setHtml(sanitizeMessageHtml(plainTextToEditorHtml(body)));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [body]);

  if (!htmlMessageHasContent(body)) {
    return <span className={emptyClassName}>—</span>;
  }

  if (!html) {
    return <span className={emptyClassName}>…</span>;
  }

  return (
    <div
      className={`message-rich-text text-sm leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
