import { useCallback, useEffect, useState } from 'react';
import type { TaskComment } from '../lib/taskboard/types';
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  subscribeToTaskComments,
  updateTaskComment,
} from '../lib/taskboard/commentService';
import { notifyTaskComment } from '../lib/taskboard/notifyComment';

export function useTaskComments(
  taskId: string | null,
  author: { username: string | null; displayName: string | null }
) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (!taskId) {
      setComments([]);
      return;
    }
    try {
      const rows = await fetchTaskComments(taskId);
      setComments(rows);
      setError('');
    } catch {
      setError('Could not load comments.');
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) {
      setComments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetchTaskComments(taskId)
      .then((rows) => {
        if (cancelled) return;
        setComments(rows);
        setError('');
      })
      .catch(() => {
        if (cancelled) return;
        setError('Could not load comments.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const unsubscribe = subscribeToTaskComments(taskId, () => {
      reload();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [taskId, reload]);

  const postComment = useCallback(
    async (body: string) => {
      if (!taskId || !author.username) {
        throw new Error('You must be logged in to comment.');
      }
      const displayName = author.displayName?.trim() || author.username;
      const created = await createTaskComment(taskId, body, {
        username: author.username,
        displayName,
      });
      setComments((prev) => [...prev, created]);
      setError('');
      notifyTaskComment(taskId, created.id);
      return created;
    },
    [taskId, author.username, author.displayName]
  );

  const editComment = useCallback(
    async (commentId: string, body: string) => {
      const updated = await updateTaskComment(commentId, body, author.username);
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      setError('');
      return updated;
    },
    [author.username]
  );

  const removeComment = useCallback(
    async (commentId: string) => {
      await deleteTaskComment(commentId, author.username);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setError('');
    },
    [author.username]
  );

  return {
    comments,
    loading,
    error,
    setError,
    postComment,
    editComment,
    removeComment,
    reload,
  };
}
