import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AddTaskDialog from './AddTaskDialog';
import { getLocalTaskCount } from '../../lib/taskboard/localTasksStorage';
import {
  createTask,
  importLocalTasksToSupabase,
  isLocalTaskboardMode,
  fetchProjects,
} from '../../lib/taskboard/taskService';
import type { TaskCategory } from '../../lib/taskboard/constants';

export default function TaskboardHeaderActions() {
  const navigate = useNavigate();
  const supabaseMode = !isLocalTaskboardMode();
  const [localCount, setLocalCount] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  const refreshLocalCount = useCallback(() => {
    setLocalCount(getLocalTaskCount());
  }, []);

  useEffect(() => {
    refreshLocalCount();
  }, [refreshLocalCount]);

  const handleCreate = async ({
    category,
    projectId,
  }: {
    category: TaskCategory;
    projectId: string;
  }) => {
    const task = await createTask({ project_id: projectId, category });
    const projects = await fetchProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      navigate(`/taskboard/projects/${project.slug}?task=${task.id}`);
    } else {
      window.location.reload();
    }
  };

  const handleImport = async () => {
    setImportMsg('');
    const count = getLocalTaskCount();
    if (count === 0) {
      setImportMsg(
        'No local tasks on this port. If you used another port (e.g. :5174), open that URL and click Import here.'
      );
      return;
    }
    setImporting(true);
    try {
      const { imported } = await importLocalTasksToSupabase();
      if (imported > 0) {
        window.location.reload();
      } else {
        setImportMsg('Nothing to import.');
      }
    } catch {
      setImportMsg('Import failed — check you are logged in and Supabase is configured.');
    } finally {
      setImporting(false);
      refreshLocalCount();
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setAddOpen(true)} className="tb-btn-primary">
          + Add task
        </button>
        {supabaseMode && (
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="tb-btn-secondary"
          >
            {importing
              ? 'Importing…'
              : localCount > 0
                ? `Import ${localCount} local task${localCount === 1 ? '' : 's'}`
                : 'Import local tasks'}
          </button>
        )}
      </div>
      {importMsg && <p className="text-xs tb-muted mt-2 max-w-xl text-right">{importMsg}</p>}
      <AddTaskDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={handleCreate}
      />
    </>
  );
}
