interface CompleteUndoToastProps {
  taskName: string;
  secondsLeft: number;
  onUndo: () => void;
}

export default function CompleteUndoToast({
  taskName,
  secondsLeft,
  onUndo,
}: CompleteUndoToastProps) {
  return (
    <div
        className="taskboard fixed bottom-4 right-4 z-[90] w-[min(100vw-2rem,320px)] tb-card shadow-lg px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm tb-text font-medium">Task completed</p>
      <p className="text-xs tb-text-secondary mt-0.5 truncate">{taskName}</p>
      <button
        type="button"
        onClick={onUndo}
        className="mt-2 text-sm font-medium text-[var(--tb-accent)] hover:text-[var(--tb-accent-hover)] transition-colors"
      >
        Undo ({secondsLeft}s)
      </button>
    </div>
  );
}
