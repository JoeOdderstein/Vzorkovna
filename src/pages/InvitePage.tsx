import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Nav from '../components/Nav';
import HeroVideoBackground from '../components/HeroVideoBackground';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { acceptInvite, fetchInvite } from '../lib/taskboard/memberService';

export default function InvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { login, authenticated, loading: authLoading } = useTaskboardAuth();
  const [username, setUsername] = useState('');
  const [boardName, setBoardName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!token) {
      setError('This invite link is missing a token.');
      setLoading(false);
      return;
    }

    fetchInvite(token)
      .then((invite) => {
        setUsername(invite.username);
        setBoardName(invite.boardName);
        setExpired(invite.expired);
        if (invite.expired) {
          setError('This invite link has expired. Ask an admin to send a new one.');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'This invite link is not valid.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!authLoading && authenticated) {
      navigate('/taskboard', { replace: true });
    }
  }, [authenticated, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await acceptInvite(token, password, confirmPassword);
      const loginError = await login(result.username, password);
      if (loginError) {
        setError('Password saved. Sign in from the login page.');
        return;
      }
      navigate('/taskboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Nav activeSection="login" />
      <div className="fixed inset-0 z-0">
        <HeroVideoBackground />
      </div>
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
        <div className="relative w-full max-w-md border site-border site-surface px-8 py-10 bg-[rgba(5,5,5,0.72)] backdrop-blur-sm">
          <span className="font-sans text-[0.65rem] tracking-[0.3em] uppercase text-[var(--color-accent)] block mb-4">
            Invite
          </span>
          <h2
            className="font-serif text-3xl font-light site-text mb-4"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Choose your password
          </h2>

          {loading ? (
            <p className="font-sans text-sm site-text-subtle">Loading invite…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <p className="font-sans text-sm site-text-subtle">
                {boardName ? `Hi ${boardName}. ` : ''}
                Username: <span className="site-text">{username || '—'}</span>
              </p>
              <div>
                <label className="font-sans text-[0.65rem] tracking-[0.2em] uppercase site-text-subtle block mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={expired || !username}
                  className="w-full bg-transparent border site-border px-4 py-3 font-sans text-sm site-text placeholder:site-text-faint focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label className="font-sans text-[0.65rem] tracking-[0.2em] uppercase site-text-subtle block mb-2">
                  Confirm password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={expired || !username}
                  className="w-full bg-transparent border site-border px-4 py-3 font-sans text-sm site-text placeholder:site-text-faint focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                />
              </div>
              {error && (
                <p className="font-sans text-xs text-red-400/90 tracking-wide">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting || expired || !username}
                className="w-full py-3 font-sans text-xs tracking-[0.25em] uppercase border site-border site-link-muted hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-300 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Save password and sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
