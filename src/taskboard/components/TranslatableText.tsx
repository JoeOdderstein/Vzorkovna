import { useEffect, useState } from 'react';
import { useTaskboardI18n } from '../../hooks/useTaskboardI18n';
import { translateText } from '../../lib/taskboard/translateService';

interface TranslatableTextProps {
  text: string;
  className?: string;
  /** Preserve line breaks (comments, descriptions). */
  multiline?: boolean;
  /** Muted helper style under form fields. */
  variant?: 'inline' | 'hint';
}

export default function TranslatableText({
  text,
  className = '',
  multiline = false,
  variant = 'inline',
}: TranslatableTextProps) {
  const { t, translateUserContent } = useTaskboardI18n();

  const [display, setDisplay] = useState(text);
  const [showOriginal, setShowOriginal] = useState(false);
  const [wasTranslated, setWasTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setShowOriginal(false);
  }, [text]);

  useEffect(() => {
    if (!translateUserContent) {
      setDisplay(text);
      setWasTranslated(false);
      setError('');
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      setDisplay(text);
      setWasTranslated(false);
      return;
    }

    if (showOriginal) {
      setDisplay(text);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    void translateText(trimmed, 'uk')
      .then((result) => {
        if (cancelled) return;
        setDisplay(result.text);
        setWasTranslated(result.translated);
      })
      .catch((err) => {
        if (cancelled) return;
        setDisplay(text);
        setWasTranslated(false);
        setError(err instanceof Error ? err.message : 'Translation unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [text, translateUserContent, showOriginal]);

  if (!translateUserContent) {
    return (
      <span className={`${multiline ? 'whitespace-pre-wrap break-words' : ''} ${className}`.trim()}>
        {text}
      </span>
    );
  }

  const bodyClass =
    variant === 'hint'
      ? `text-xs tb-muted italic ${multiline ? 'whitespace-pre-wrap break-words' : ''} ${className}`
      : `${multiline ? 'whitespace-pre-wrap break-words' : ''} ${className}`;

  return (
    <span className="block">
      <span className={bodyClass.trim()}>
        {loading && translateUserContent && !showOriginal ? text : display}
      </span>
      {loading && !showOriginal && (
        <span className="block text-[10px] tb-muted mt-0.5">{t('translate.translating')}</span>
      )}
      {error && !loading && (
        <span className="block text-[10px] text-amber-700 mt-0.5">{error}</span>
      )}
      {wasTranslated && !loading && (
        <button
          type="button"
          onClick={() => setShowOriginal((value) => !value)}
          className="block text-[10px] tb-link mt-0.5"
        >
          {showOriginal ? t('translate.showUkrainian') : t('translate.showOriginal')}
        </button>
      )}
    </span>
  );
}
