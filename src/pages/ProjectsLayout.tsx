import { useState } from 'react';
import { ArrowLeft, User } from 'lucide-react';
import { Link, Navigate, Outlet, useLocation, useMatch } from 'react-router-dom';
import Nav from '../components/Nav';
import { PROJECTS_PATH } from '../lib/taskboard/driveConstants';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { UserProfileProvider } from '../context/UserProfileContext';
import { TaskboardThemeProvider, useTaskboardTheme } from '../context/TaskboardThemeContext';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import ProfileSettingsDialog from '../taskboard/components/ProfileSettingsDialog';
import TaskboardThemeToggle from '../taskboard/components/TaskboardThemeToggle';
import TbIconTooltip from '../taskboard/components/TbIconTooltip';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';

function ProjectsShell() {
  const { authenticated, loading, sessionReady } = useTaskboardAuth();
  const { theme } = useTaskboardTheme();
  const location = useLocation();
  const installationDetailMatch = useMatch(`${PROJECTS_PATH}/installation/:installationId`);
  const [profileOpen, setProfileOpen] = useState(false);
  const { t } = useTaskboardI18n();
  const waitingForSession = authenticated && isSupabaseConfigured() && !sessionReady;

  if (loading || waitingForSession) {
    return (
      <>
        <Nav activeSection="login" />
        <main className="taskboard min-h-screen pt-28 px-8" data-theme={theme}>
          <p className="text-sm tb-muted">{t('common.loading')}</p>
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
      <div className="taskboard min-h-screen pt-20 pb-16" data-theme={theme}>
        <div className="max-w-screen-2xl mx-auto px-6 md:px-10 shrink-0">
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="min-w-0">
              {installationDetailMatch ? (
                <Link
                  to={PROJECTS_PATH}
                  className="inline-flex items-center gap-2 text-sm tb-muted hover:text-[var(--tb-accent)]"
                >
                  <ArrowLeft size={16} aria-hidden />
                  {t('projects.detail.back')}
                </Link>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <TaskboardThemeToggle />
              <TbIconTooltip label={t('header.profile')}>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="tb-btn-secondary px-2.5"
                  aria-label={t('header.profileAria')}
                >
                  <User size={18} />
                </button>
              </TbIconTooltip>
            </div>
          </div>
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
