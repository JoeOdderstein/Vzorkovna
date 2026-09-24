import { useState } from 'react';
import { User } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import Nav from '../../components/Nav';
import { TaskboardFilterProvider } from '../../context/TaskboardFilterContext';
import { CompleteUndoProvider } from '../../context/CompleteUndoContext';
import { TaskboardRefreshProvider } from '../../context/TaskboardRefreshContext';
import { TaskboardThemeProvider, useTaskboardTheme } from '../../context/TaskboardThemeContext';
import { UserProfileProvider, useUserProfile } from '../../context/UserProfileContext';
import { useTaskboardAuth } from '../../context/TaskboardAuthContext';
import ProfileSettingsDialog from '../../taskboard/components/ProfileSettingsDialog';
import TbIconTooltip from '../../taskboard/components/TbIconTooltip';
import { isLocalTaskboardMode } from '../../lib/taskboard/taskService';
import { isSupabaseConfigured } from '../../lib/taskboard/config';
import AddTaskFab from '../../taskboard/components/AddTaskFab';
import AssigneeFilterBar from '../../taskboard/components/AssigneeFilterBar';
import TaskDrawerHost from '../../taskboard/components/TaskDrawerHost';
import ManageProjectsHeaderAction from '../../taskboard/components/ManageProjectsHeaderAction';
import TaskboardHeaderActions from '../../taskboard/components/TaskboardHeaderActions';
import TaskboardThemeToggle from '../../taskboard/components/TaskboardThemeToggle';
import { TaskboardSelectionProvider, useTaskboardSelection } from '../../context/TaskboardSelectionContext';

function TaskboardShell() {
  const { authenticated, loading, sessionReady, isAdmin } = useTaskboardAuth();
  const { theme } = useTaskboardTheme();
  const { loading: profileLoading } = useUserProfile();
  const { selected } = useTaskboardSelection();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const waitingForSession = authenticated && isSupabaseConfigured() && !sessionReady;

  if (loading || waitingForSession || profileLoading) {
    return (
      <>
        <Nav activeSection="login" />
        <main className="taskboard min-h-screen pt-28 px-8" data-theme={theme}>
          <p className="text-sm tb-muted">Loading…</p>
        </main>
      </>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className={`tb-layout-push${selected ? ' tb-layout-push--open' : ''}`}>
      <Nav activeSection="login" />
      <div className="taskboard min-h-screen pt-20 pb-16" data-theme={theme}>
        <div className="tb-divider mb-8">
          <div
            className={`tb-taskboard-page px-6 md:px-10 pt-0.5 pb-4 flex flex-col gap-4 mx-auto max-w-screen-2xl${
              selected ? ' tb-taskboard-page--drawer-open' : ''
            }`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-4 min-w-0">
                <div className="flex items-center gap-6 shrink-0">
                  <Link to="/taskboard" className="tb-heading hover:opacity-80 transition-opacity">
                    Taskboard
                  </Link>
                  <Link to="/taskboard/archive" className="tb-link">
                    Archive
                  </Link>
                </div>
                {isAdmin && <ManageProjectsHeaderAction />}
              </div>
              <div className="tb-header-scroll-row md:justify-end">
                <TaskboardThemeToggle />
                <TbIconTooltip label="Profile">
                  <button
                    type="button"
                    onClick={() => setProfileOpen(true)}
                    className="tb-btn-secondary px-2.5 shrink-0"
                    aria-label="Open profile settings"
                  >
                    <User size={18} />
                  </button>
                </TbIconTooltip>
                <TaskboardHeaderActions />
              </div>
            </div>
            <AssigneeFilterBar />
          </div>
        </div>
        <div
          data-taskboard-interactive
          className={selected ? 'tb-taskboard-content--drawer-open' : undefined}
        >
          <Outlet />
        </div>
        <AddTaskFab />
        <TaskDrawerHost />
        <ProfileSettingsDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
        {isLocalTaskboardMode() && (
          <p className="max-w-screen-2xl mx-auto px-6 md:px-10 mt-8 text-xs tb-muted">
            Local mode — tasks are saved in this browser. Add Supabase keys to .env for shared storage and realtime sync.
          </p>
        )}
      </div>
    </div>
  );
}

export default function TaskboardLayout() {
  return (
    <UserProfileProvider>
      <TaskboardThemeProvider>
        <TaskboardFilterProvider>
          <CompleteUndoProvider>
            <TaskboardRefreshProvider>
              <TaskboardSelectionProvider>
                <TaskboardShell />
              </TaskboardSelectionProvider>
            </TaskboardRefreshProvider>
          </CompleteUndoProvider>
        </TaskboardFilterProvider>
      </TaskboardThemeProvider>
    </UserProfileProvider>
  );
}
