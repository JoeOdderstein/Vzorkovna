import { useState, type CSSProperties } from 'react';
import { User } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Nav from '../components/Nav';
import { MESSAGES_PATH } from '../lib/taskboard/driveConstants';
import { useTaskboardI18n } from '../hooks/useTaskboardI18n';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { UserProfileProvider, useUserProfile } from '../context/UserProfileContext';
import { TaskboardThemeProvider, useTaskboardTheme } from '../context/TaskboardThemeContext';
import { isSupabaseConfigured } from '../lib/taskboard/config';
import ProfileSettingsDialog from '../taskboard/components/ProfileSettingsDialog';
import ManageMembersHeaderAction from '../taskboard/components/ManageMembersHeaderAction';
import TaskboardThemeToggle from '../taskboard/components/TaskboardThemeToggle';
import TbIconTooltip from '../taskboard/components/TbIconTooltip';
import {
  MessagesComposeProvider,
  useMessagesCompose,
} from '../context/MessagesComposeContext';

function RemoteInstShell() {
  const { authenticated, loading, sessionReady, canAccessMessages, isAdmin } = useTaskboardAuth();
  const { theme } = useTaskboardTheme();
  const {
    drawerOpen: composeDrawerOpen,
    drawerWidth: composeDrawerWidth,
    drawerOverlaysFeed: composeOverlaysFeed,
  } = useMessagesCompose();
  const { loading: profileLoading } = useUserProfile();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { t } = useTaskboardI18n();
  const isMessagesPage = location.pathname.startsWith(MESSAGES_PATH);
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

  if (!canAccessMessages) {
    return <Navigate to="/taskboard" replace />;
  }

  const layoutPush =
    isMessagesPage && composeDrawerOpen && !composeOverlaysFeed ? ' tb-layout-push--open' : '';

  const layoutPushStyle: CSSProperties | undefined =
    isMessagesPage && composeDrawerOpen && !composeOverlaysFeed
      ? ({ ['--tb-drawer-width' as string]: `${composeDrawerWidth}px` } as CSSProperties)
      : undefined;

  return (
    <div className={`tb-layout-push${layoutPush}`} style={layoutPushStyle}>
      <Nav activeSection="login" />
      <div
        className={`taskboard flex flex-col ${
          isMessagesPage
            ? 'h-dvh max-h-dvh min-h-0 overflow-hidden pt-20 pb-6'
            : 'min-h-screen pt-24 pb-16'
        }`}
        data-theme={theme}
      >
        <div
          className={`mx-auto w-full px-6 md:px-10 shrink-0 ${
            isMessagesPage ? 'max-w-none' : 'max-w-screen-2xl'
          }`}
        >
          <div className="flex items-start justify-between gap-4 py-2">
            {isMessagesPage ? (
              <header className="min-w-0 flex-1 pr-4">
                <span className="tb-label block leading-tight">{t('nav.remoteInst')}</span>
              </header>
            ) : (
              <span className="flex-1" aria-hidden />
            )}
            <div className="flex shrink-0 items-center gap-3">
              {isAdmin ? <ManageMembersHeaderAction /> : null}
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
        <div
          className={`mx-auto w-full px-6 md:px-10 flex-1 min-h-0 flex flex-col ${
            isMessagesPage ? 'max-w-none' : 'max-w-screen-2xl'
          }${isMessagesPage && composeDrawerOpen ? ' tb-messages-content--compose-open' : ''}`}
        >
          <Outlet />
        </div>
        <ProfileSettingsDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
      </div>
    </div>
  );
}

export default function RemoteInstLayout() {
  return (
    <UserProfileProvider>
      <TaskboardThemeProvider>
        <MessagesComposeProvider>
          <RemoteInstShell />
        </MessagesComposeProvider>
      </TaskboardThemeProvider>
    </UserProfileProvider>
  );
}
