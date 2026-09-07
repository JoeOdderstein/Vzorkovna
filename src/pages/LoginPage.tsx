import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
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
        <main className="min-h-screen pt-28 px-8" style={{ backgroundColor: 'var(--color-black)' }}>
          <p className="font-sans text-sm text-white/40">Loading…</p>
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
        style={{ backgroundColor: 'var(--color-black)' }}
      >
        <div className="max-w-screen-md mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-sans text-xs tracking-[0.2em] uppercase text-white/40 hover:text-white/70 transition-colors duration-300 mb-12"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to site
          </Link>

          <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-6">
            Login
          </span>
          <h1
            className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-light leading-tight text-white/90 mb-6"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Taskboard
          </h1>

          {!showModal && (
            <button
              onClick={() => setShowModal(true)}
              className="font-sans text-xs tracking-[0.2em] uppercase text-[var(--color-accent)] hover:text-white transition-colors duration-300"
            >
              Open login
            </button>
          )}
        </div>
      </main>
    </>
  );
}
