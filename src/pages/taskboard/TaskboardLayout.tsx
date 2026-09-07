import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import Nav from '../../components/Nav';
import { TaskboardFilterProvider } from '../../context/TaskboardFilterContext';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';
import { isSupabaseConfigured } from '../../lib/taskboard/config';
import AssigneeFilterBar from '../../taskboard/components/AssigneeFilterBar';
import TaskboardHeaderActions from '../../taskboard/components/TaskboardHeaderActions';

function TaskboardShell() {
  const { authenticated, loading, sessionReady } = useTaskboardAuth();
  const location = useLocation();
  const waitingForSession = authenticated && isSupabaseConfigured() && !sessionReady;

  if (loading || waitingForSession) {
    return (
      <>
        <Nav activeSection="login" />
        <main className="taskboard min-h-screen pt-28 px-8">
          <p className="text-sm tb-muted">Loading…</p>
        </main>
      </>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <>
      <Nav activeSection="login" />
      <div className="taskboard min-h-screen pt-24 pb-16">
        <div className="tb-divider mb-8">
          <div className="max-w-screen-2xl mx-auto px-6 md:px-10 py-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-6">
                <Link to="/taskboard" className="tb-heading hover:opacity-80 transition-opacity">
                  Taskboard
                </Link>
                <Link to="/taskboard/archive" className="tb-link">
                  Archive
                </Link>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex flex-wrap items-center gap-4">
                  <TaskboardHeaderActions />
                  <Link to="/" className="tb-link">
                    Back to site
                  </Link>
                </div>
              </div>
            </div>
            <AssigneeFilterBar />
          </div>
        </div>
        <Outlet />
        {isLocalTaskboardMode() && (
          <p className="max-w-screen-2xl mx-auto px-6 md:px-10 mt-8 text-xs tb-muted">
            Local mode — tasks are saved in this browser. Add Supabase keys to .env for shared storage and realtime sync.
          </p>
        )}
      </div>
    </>
  );
}

export default function TaskboardLayout() {
  return (
    <TaskboardFilterProvider>
      <TaskboardShell />
    </TaskboardFilterProvider>
  );
}
