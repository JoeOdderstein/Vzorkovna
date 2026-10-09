import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { TaskboardAuthProvider } from './context/TaskboardAuthContext';
import { CALENDAR_PATH, INVOICES_PATH, PROJECTS_PATH } from './lib/taskboard/driveConstants';
const HomePage = lazy(() => import('./pages/HomePage'));
const InvitePage = lazy(() => import('./pages/InvitePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const ArchivePage = lazy(() => import('./pages/taskboard/ArchivePage'));
const ProjectBoardPage = lazy(() => import('./pages/taskboard/ProjectBoardPage'));
const TaskboardLayout = lazy(() => import('./pages/taskboard/TaskboardLayout'));
const TaskboardOverviewPage = lazy(() => import('./pages/taskboard/TaskboardOverviewPage'));
const InstallationDetailPage = lazy(() => import('./pages/InstallationDetailPage'));
const ProjectsLayout = lazy(() => import('./pages/ProjectsLayout'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const RemoteInstLayout = lazy(() => import('./pages/RemoteInstLayout'));
const RemoteInstPage = lazy(() => import('./pages/RemoteInstPage'));
const RemoteInstPopupPage = lazy(() => import('./pages/RemoteInstPopupPage'));
const InvoicesLayout = lazy(() => import('./pages/InvoicesLayout'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const CalendarLayout = lazy(() => import('./pages/CalendarLayout'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));

function RouteFallback() {
  return (
    <main
      className="taskboard min-h-screen flex items-center justify-center px-6"
      data-theme="light"
    >
      <p className="text-sm tb-muted">Loading…</p>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <TaskboardAuthProvider>
        <div className="relative min-h-screen" style={{ backgroundColor: 'var(--site-bg)' }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/invite" element={<InvitePage />} />
              <Route path={`${PROJECTS_PATH}/installation/:installationId`} element={<ProjectsLayout />}>
                <Route index element={<InstallationDetailPage />} />
              </Route>
              <Route path={PROJECTS_PATH} element={<ProjectsLayout />}>
                <Route index element={<ProjectsPage />} />
              </Route>
              <Route path="/work/:id" element={<ProjectDetailPage />} />
              <Route path="/taskboard" element={<TaskboardLayout />}>
                <Route index element={<TaskboardOverviewPage />} />
                <Route path="projects/:slug" element={<ProjectBoardPage />} />
                <Route path="archive" element={<ArchivePage />} />
              </Route>
              <Route path="/remote-inst/popup/:installationId" element={<RemoteInstPopupPage />} />
              <Route path="/remote-inst" element={<Navigate to="/messages" replace />} />
              <Route path="/messages" element={<RemoteInstLayout />}>
                <Route index element={<RemoteInstPage />} />
              </Route>
              <Route path={INVOICES_PATH} element={<InvoicesLayout />}>
                <Route index element={<InvoicesPage />} />
              </Route>
              <Route path={CALENDAR_PATH} element={<CalendarLayout />}>
                <Route index element={<CalendarPage />} />
              </Route>
            </Routes>
          </Suspense>
        </div>
      </TaskboardAuthProvider>
    </BrowserRouter>
  );
}
