import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Cursor from './components/Cursor';
import { TaskboardAuthProvider } from './context/TaskboardAuthContext';
import { PROJECTS_PATH } from './lib/taskboard/driveConstants';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ArchivePage from './pages/taskboard/ArchivePage';
import ProjectBoardPage from './pages/taskboard/ProjectBoardPage';
import TaskboardLayout from './pages/taskboard/TaskboardLayout';
import TaskboardOverviewPage from './pages/taskboard/TaskboardOverviewPage';
import InstallationDetailPage from './pages/InstallationDetailPage';
import ProjectsLayout from './pages/ProjectsLayout';
import ProjectsPage from './pages/ProjectsPage';
import RemoteInstLayout from './pages/RemoteInstLayout';
import RemoteInstPage from './pages/RemoteInstPage';
import RemoteInstPopupPage from './pages/RemoteInstPopupPage';

export default function App() {
  return (
    <BrowserRouter>
      <TaskboardAuthProvider>
        <div className="relative min-h-screen" style={{ backgroundColor: 'var(--site-bg)' }}>
          <Cursor />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path={PROJECTS_PATH} element={<ProjectsLayout />}>
              <Route index element={<ProjectsPage />} />
              <Route path="installation/:installationId" element={<InstallationDetailPage />} />
            </Route>
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/taskboard" element={<TaskboardLayout />}>
              <Route index element={<TaskboardOverviewPage />} />
              <Route path="projects/:slug" element={<ProjectBoardPage />} />
              <Route path="archive" element={<ArchivePage />} />
            </Route>
            <Route path="/remote-inst/popup/:installationId" element={<RemoteInstPopupPage />} />
            <Route path="/remote-inst" element={<RemoteInstLayout />}>
              <Route index element={<RemoteInstPage />} />
            </Route>
          </Routes>
        </div>
      </TaskboardAuthProvider>
    </BrowserRouter>
  );
}
