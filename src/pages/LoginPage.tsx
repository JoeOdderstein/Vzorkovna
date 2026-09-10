import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import LoginModal from '../components/LoginModal';
import HeroVideoBackground from '../components/HeroVideoBackground';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { authenticated, loading } = useTaskboardAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!loading && authenticated) {
      navigate('/taskboard', { replace: true });
    }
  }, [authenticated, loading, navigate]);

  return (
    <>
      <Nav activeSection="login" />

      <div className="fixed inset-0 z-0">
        <HeroVideoBackground />
      </div>

      {loading && (
        <main className="relative z-10 min-h-screen pt-28 px-8">
          <p className="font-sans text-sm site-text-subtle">Loading…</p>
        </main>
      )}

      {!loading && !authenticated && (
        <LoginModal onSuccess={() => navigate('/taskboard', { replace: true })} />
      )}
    </>
  );
}
