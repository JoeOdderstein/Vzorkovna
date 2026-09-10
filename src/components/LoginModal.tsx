import { FormEvent, useEffect, useState } from 'react';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';

interface LoginModalProps {
  onSuccess: () => void;
}

export default function LoginModal({ onSuccess }: LoginModalProps) {
  const { login } = useTaskboardAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const err = await login(username, password);
    setSubmitting(false);

    if (err) {
      setError(err);
      return;
    }

    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="relative w-full max-w-md border site-border site-surface px-8 py-10 bg-[rgba(5,5,5,0.72)] backdrop-blur-sm">
        <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-4">
          Login
        </span>
        <h2
          className="font-serif text-3xl font-light site-text mb-8"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Taskboard
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="login-username"
              className="font-sans text-[0.65rem] tracking-[0.2em] uppercase site-text-subtle block mb-2"
            >
              Username
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full bg-transparent border site-border px-4 py-3 font-sans text-sm site-text placeholder:site-text-faint focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="font-sans text-[0.65rem] tracking-[0.2em] uppercase site-text-subtle block mb-2"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full bg-transparent border site-border px-4 py-3 font-sans text-sm site-text placeholder:site-text-faint focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <p className="font-sans text-xs text-red-400/90 tracking-wide">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 font-sans text-xs tracking-[0.25em] uppercase border site-border site-link-muted hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-300 disabled:opacity-50"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
