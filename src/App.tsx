import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Cursor from './components/Cursor';
import HomePage from './pages/HomePage';
import ProjectDetailPage from './pages/ProjectDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative" style={{ backgroundColor: 'var(--color-black)' }}>
        <Cursor />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
