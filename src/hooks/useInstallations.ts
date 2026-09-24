import { useEffect, useState } from 'react';
import { getInstallationById, listInstallations } from '../lib/installations/installationService';
import type { InstallationRecord } from '../lib/installations/types';

export function useInstallations() {
  const [installations, setInstallations] = useState<InstallationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () => {
      void listInstallations()
        .then((rows) => {
          if (!cancelled) {
            setInstallations(rows);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('Could not load installations.');
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    };

    load();

    const onUpdated = () => load();
    window.addEventListener('installations-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('installations-updated', onUpdated);
    };
  }, []);

  return { installations, loading, error };
}

export function useInstallation(installationId: string | undefined) {
  const [installation, setInstallation] = useState<InstallationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!installationId) {
      setInstallation(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void getInstallationById(installationId)
      .then((record) => {
        if (!cancelled) {
          setInstallation(record);
          setError(record ? null : 'Installation not found.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not load installation.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [installationId]);

  return { installation, setInstallation, loading, error };
}
