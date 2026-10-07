import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import LoginModal from '../components/LoginModal';
import HeroVideoBackground from '../components/HeroVideoBackground';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';

function loginRedirectTarget(state: unknown): string {
  if (!state || typeof state !== 'object' || !('from' in state)) {
    return '/taskboard';
  }
  const from = (state as { from?: unknown }).from;
  return typeof from === 'string' && from.startsWith('/') ? from : '/taskboard';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { authenticated, loading } = useTaskboardAuth();
  const redirectTo = loginRedirectTarget(location.state);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!loading && authenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [authenticated, loading, navigate, redirectTo]);

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
        <LoginModal onSuccess={() => navigate(redirectTo, { replace: true })} />
      )}
    </>
  );
}
