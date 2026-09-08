import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import CompleteUndoToast from '../taskboard/components/CompleteUndoToast';

interface CompleteUndoOptions {
  taskName: string;
  onUndo: () => Promise<void>;
}

interface CompleteUndoContextValue {
  showCompleteUndo: (options: CompleteUndoOptions) => void;
  dismissCompleteUndo: () => void;
}

const CompleteUndoContext = createContext<CompleteUndoContextValue | null>(null);

export function CompleteUndoProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ taskName: string; secondsLeft: number } | null>(null);
  const undoRef = useRef<(() => Promise<void>) | null>(null);

  const dismissCompleteUndo = useCallback(() => {
    undoRef.current = null;
    setToast(null);
  }, []);

  const showCompleteUndo = useCallback(
    ({ taskName, onUndo }: CompleteUndoOptions) => {
      undoRef.current = onUndo;
      setToast({ taskName, secondsLeft: 3 });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;

    if (toast.secondsLeft <= 0) {
      undoRef.current = null;
      setToast(null);
      return;
    }

    const timer = window.setTimeout(() => {
      setToast((prev) => (prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleUndo = useCallback(async () => {
    const undo = undoRef.current;
    dismissCompleteUndo();
    if (undo) await undo();
  }, [dismissCompleteUndo]);

  const value = useMemo(
    () => ({ showCompleteUndo, dismissCompleteUndo }),
    [showCompleteUndo, dismissCompleteUndo]
  );

  return (
    <CompleteUndoContext.Provider value={value}>
      {children}
      {toast && (
        <CompleteUndoToast
          taskName={toast.taskName}
          secondsLeft={toast.secondsLeft}
          onUndo={handleUndo}
        />
      )}
    </CompleteUndoContext.Provider>
  );
}

export function useCompleteUndo() {
  const ctx = useContext(CompleteUndoContext);
  if (!ctx) throw new Error('useCompleteUndo must be used within CompleteUndoProvider');
  return ctx;
}
