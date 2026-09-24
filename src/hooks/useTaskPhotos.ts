import { useCallback, useEffect, useState } from 'react';
import type { TaskPhoto } from '../lib/taskboard/types';
import {
  addTaskPhoto,
  deleteTaskPhoto,
  fetchTaskPhotos,
} from '../lib/taskboard/taskPhotoService';

export function useTaskPhotos(taskId: string | null) {
  const [photos, setPhotos] = useState<TaskPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!taskId) {
      setPhotos([]);
      return;
    }
    try {
      const rows = await fetchTaskPhotos(taskId);
      setPhotos(rows);
      setError('');
    } catch {
      setError('Could not load photos.');
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchTaskPhotos(taskId)
      .then((rows) => {
        if (cancelled) return;
        setPhotos(rows);
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load photos.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const uploadPhotos = useCallback(
    async (files: File[]) => {
      if (!taskId || files.length === 0) return;
      setUploading(true);
      setError('');
      try {
        for (const file of files) {
          await addTaskPhoto(taskId, file);
        }
        await reload();
      } catch {
        setError('Upload failed.');
        throw new Error('Upload failed.');
      } finally {
        setUploading(false);
      }
    },
    [taskId]
  );

  const removePhoto = useCallback(
    async (photoId: string) => {
      if (!taskId) return;
      setError('');
      try {
        await deleteTaskPhoto(photoId, taskId);
        setPhotos((prev) => prev.filter((photo) => photo.id !== photoId));
      } catch {
        setError('Could not remove photo.');
        throw new Error('Could not remove photo.');
      }
    },
    [taskId]
  );

  return {
    photos,
    loading,
    uploading,
    error,
    setError,
    uploadPhotos,
    removePhoto,
    reload,
  };
}

