import { useState } from 'react';
import { User } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Nav from '../components/Nav';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { UserProfileProvider, useUserProfile } from '../context/UserProfileContext';
import { TaskboardThemeProvider, useTaskboardTheme } from '../context/TaskboardThemeContext';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import ProfileSettingsDialog from '../taskboard/components/ProfileSettingsDialog';
import TaskboardThemeToggle from '../taskboard/components/TaskboardThemeToggle';
import TbIconTooltip from '../taskboard/components/TbIconTooltip';

function ProjectsShell() {
  const { authenticated, loading, sessionReady } = useTaskboardAuth();
  const { theme } = useTaskboardTheme();
  const { loading: profileLoading } = useUserProfile();
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
    <>
      <Nav activeSection="login" />
      <div className="taskboard min-h-screen pt-24 pb-16" data-theme={theme}>
        <div className="max-w-screen-2xl mx-auto px-6 md:px-10 py-4 flex justify-end gap-4">
          <TaskboardThemeToggle />
          <TbIconTooltip label="Profile">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="tb-btn-secondary px-2.5"
              aria-label="Open profile settings"
            >
              <User size={18} />
            </button>
          </TbIconTooltip>
        </div>
        <Outlet />
        <ProfileSettingsDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    </>
  );
}

export default function ProjectsLayout() {
  return (
    <UserProfileProvider>
      <TaskboardThemeProvider>
        <ProjectsShell />
      </TaskboardThemeProvider>
    </UserProfileProvider>
  );
}
