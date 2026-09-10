import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Nav from '../components/Nav';
import LoginModal from '../components/LoginModal';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { authenticated, loading } = useTaskboardAuth();
  const [showModal, setShowModal] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!loading && authenticated) {
      navigate('/taskboard', { replace: true });
    }
  }, [authenticated, loading, navigate]);

  if (loading) {
    return (
      <>
        <Nav activeSection="login" />
        <main className="min-h-screen pt-28 px-8" style={{ backgroundColor: 'var(--site-bg)' }}>
          <p className="font-sans text-sm site-text-subtle">Loading…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav activeSection="login" />

      {showModal && !authenticated && (
        <LoginModal
          onSuccess={() => navigate('/taskboard', { replace: true })}
          onClose={() => navigate('/')}
        />
      )}

      <main
        className="relative min-h-screen pt-28 pb-24 px-8 md:px-16"
        style={{ backgroundColor: 'var(--site-bg)' }}
      >
        <div className="max-w-screen-md mx-auto">
          <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-6">
            Login
          </span>
          <h1
            className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-light leading-tight site-text mb-6"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Taskboard
          </h1>

          {!showModal && (
            <button
              onClick={() => setShowModal(true)}
              className="font-sans text-xs tracking-[0.2em] uppercase text-[var(--color-accent)] site-link-muted"
            >
              Open login
            </button>
          )}
        </div>
      </main>
    </>
  );
}
