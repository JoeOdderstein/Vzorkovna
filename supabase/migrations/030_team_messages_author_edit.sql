-- Authors may update or delete their own team messages
DROP POLICY IF EXISTS team_messages_update ON team_messages;
CREATE POLICY team_messages_update ON team_messages
  FOR UPDATE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''))
  WITH CHECK (author_username = COALESCE(auth.jwt() ->> 'username', ''));

DROP POLICY IF EXISTS team_messages_delete ON team_messages;
CREATE POLICY team_messages_delete ON team_messages
  FOR DELETE TO authenticated
  USING (author_username = COALESCE(auth.jwt() ->> 'username', ''));
