import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Cursor from './components/Cursor';
import { TaskboardAuthProvider } from './context/TaskboardAuthContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ArchivePage from './pages/taskboard/ArchivePage';
import ProjectBoardPage from './pages/taskboard/ProjectBoardPage';
import TaskboardLayout from './pages/taskboard/TaskboardLayout';
import TaskboardOverviewPage from './pages/taskboard/TaskboardOverviewPage';

export default function App() {
  return (
    <BrowserRouter>
      <TaskboardAuthProvider>
        <div className="relative" style={{ backgroundColor: 'var(--color-black)' }}>
          <Cursor />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/taskboard" element={<TaskboardLayout />}>
              <Route index element={<TaskboardOverviewPage />} />
              <Route path="projects/:slug" element={<ProjectBoardPage />} />
              <Route path="archive" element={<ArchivePage />} />
            </Route>
          </Routes>
        </div>
      </TaskboardAuthProvider>
    </BrowserRouter>
  );
}
