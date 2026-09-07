import { useEffect, useState } from 'react';
import { getLocalTaskCount } from '../../lib/taskboard/localTasksStorage';
import { importLocalTasksToSupabase, isLocalTaskboardMode } from '../../lib/taskboard/taskService';

export default function LocalTasksImportBanner() {
  const [count, setCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isLocalTaskboardMode()) return;
    setCount(getLocalTaskCount());
  }, []);

  if (isLocalTaskboardMode() || done) return null;

  if (count === 0) {
    return (
      <div className="max-w-screen-2xl mx-auto px-6 md:px-10 mb-6">
        <p className="text-xs tb-muted px-1">
          Looking for tasks from before Supabase? If you used another dev port (e.g.{' '}
          <strong>localhost:5174</strong>), open that same URL to import them — browser storage
          is per port.
        </p>
      </div>
    );
  }

  const handleImport = async () => {
    setImporting(true);
    setError('');
    try {
      const { imported } = await importLocalTasksToSupabase();
      setDone(true);
      if (imported > 0) window.location.reload();
    } catch {
      setError('Could not import tasks. Try again or check the browser console.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-6 md:px-10 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 rounded-lg border border-[#dadce0] bg-[#e8f0fe]">
        <p className="text-sm tb-text">
          You have <strong>{count}</strong> task{count === 1 ? '' : 's'} saved locally from before
          Supabase was connected.
        </p>
        <div className="flex items-center gap-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] disabled:opacity-50 transition-colors"
          >
            {importing ? 'Importing…' : 'Import to Supabase'}
          </button>
        </div>
      </div>
    </div>
  );
}
