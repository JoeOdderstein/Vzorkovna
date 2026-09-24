-- Allow authors to delete their own comments
CREATE POLICY task_comments_delete ON task_comments
  FOR DELETE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''));
