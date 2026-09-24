import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useTaskboardAuth } from '../context/TaskboardAuthContext';
import { getInstallationById } from '../lib/installations/installationService';
import { canAccessTaskboardPrivateNav } from '../lib/taskboard/driveConstants';

export default function RemoteInstPopupPage() {
  const { installationId } = useParams<{ installationId: string }>();
  const { authenticated, loading, username, isAdmin } = useTaskboardAuth();
  const [name, setName] = useState<string | null>(null);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [lookupDone, setLookupDone] = useState(false);

  useEffect(() => {
    if (!installationId) {
      setLookupDone(true);
      return;
    }

    let cancelled = false;

    void getInstallationById(installationId)
      .then((installation) => {
        if (cancelled) return;
        setName(installation?.name ?? null);
        setRemoteUrl(installation?.remote_url ?? null);
      })
      .finally(() => {
        if (!cancelled) {
          setLookupDone(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [installationId]);

  useEffect(() => {
    if (remoteUrl) {
      window.location.replace(remoteUrl);
    }
  }, [remoteUrl]);

  if (loading || !lookupDone) {
    return (
      <main className="taskboard min-h-screen flex items-center justify-center p-8">
        <p className="text-sm tb-muted">Loading…</p>
      </main>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessTaskboardPrivateNav(username, isAdmin)) {
    return <Navigate to="/taskboard" replace />;
  }

  if (!remoteUrl) {
    return (
      <main className="taskboard min-h-screen flex items-center justify-center p-8">
        <p className="text-sm tb-muted">Remote session not available.</p>
      </main>
    );
  }

  return (
    <main className="taskboard min-h-screen flex items-center justify-center p-8">
      <p className="text-sm tb-muted">Opening {name ?? 'installation'}…</p>
    </main>
  );
}
