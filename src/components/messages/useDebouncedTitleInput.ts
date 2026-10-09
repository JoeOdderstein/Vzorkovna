import { useCallback, useEffect, useRef, useState } from 'react';

/** Uncontrolled title field — React re-renders only on debounced title / has-content updates. */
export function useDebouncedTitleInput(debounceMs = 850) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
  const [debouncedTitle, setDebouncedTitle] = useState('');
  const [hasContent, setHasContent] = useState(false);

  const titleInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    setInputEl(node);
  }, []);

  useEffect(() => {
    const input = inputEl;
    if (!input) return;

    let timer: ReturnType<typeof setTimeout> | undefined;

    const syncFromValue = () => {
      const value = input.value;
      const trimmed = value.trim();
      setHasContent(trimmed.length > 0);
      setDebouncedTitle(trimmed);
    };

    syncFromValue();

    const onInput = () => {
      const value = input.value;
      const nextHas = value.trim().length > 0;
      setHasContent((prev) => (prev === nextHas ? prev : nextHas));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const trimmed = value.trim();
        setDebouncedTitle((prev) => (prev === trimmed ? prev : trimmed));
      }, debounceMs);
    };

    input.addEventListener('input', onInput);
    return () => {
      input.removeEventListener('input', onInput);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs, inputEl]);

  const getTitle = useCallback(() => inputRef.current?.value.trim() ?? '', []);

  const clearTitle = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    setHasContent(false);
    setDebouncedTitle('');
  }, []);

  const setTitle = useCallback((value: string) => {
    if (inputRef.current) {
      inputRef.current.value = value;
    }
    const trimmed = value.trim();
    setHasContent(trimmed.length > 0);
    setDebouncedTitle(trimmed);
  }, []);

  return { inputRef: titleInputRef, debouncedTitle, hasContent, getTitle, clearTitle, setTitle };
}
